import { Bot, Context, session } from 'grammy';
import { getTextProcessor } from '../services/text-processor';
import { getImageProcessor } from '../services/image-processor';
import { getAudioProcessor } from '../services/audio-processor';
import { getDocumentProcessor } from '../services/document-processor';
import { getPromptManager } from '../services/prompt-manager';
import { getOrchestrator } from '../services/orchestrator';
import { getExpenseTrackerService } from '../services/expense-tracker.service';
import { getLogger } from '../services/logger.service';
import { handleExpenseMessage, handleExpense, formatSuccessMessage } from './handlers/expense.handler';
import { handleBalanceQuery, handleRecentTransactions, handleMonthlyReport, handleCustomReportQuery } from './handlers/query.handler';
import { handleArchiveMessage } from './handlers/archive.handler';
import { SessionData } from '../types';

export type MyContext = Context & {
  session: SessionData;
};

export class TelegramBot {
  private bot: Bot<MyContext>;
  private textProcessor;
  private imageProcessor;
  private audioProcessor;
  private documentProcessor;
  private promptManager;
  private orchestrator;
  private authorizedUserId: number | null;
  private logger = getLogger();

  constructor(token: string) {
    this.bot = new Bot<MyContext>(token);
    this.bot.use(session({ initial: (): SessionData => ({}) }));

    // Initialize services after dotenv has loaded
    this.textProcessor = getTextProcessor();
    this.imageProcessor = getImageProcessor();
    this.audioProcessor = getAudioProcessor();
    this.documentProcessor = getDocumentProcessor();
    this.promptManager = getPromptManager();
    this.orchestrator = getOrchestrator();

    // Get authorized user ID from environment
    const userId = process.env.USER_ID;
    this.authorizedUserId = userId ? parseInt(userId) : null;

    if (this.authorizedUserId) {
      this.logger.info(`Bot restricted to user ID: ${this.authorizedUserId}`);
    } else {
      this.logger.info('Bot is open to all users (USER_ID not set)');
    }

    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware() {
    // User authorization check
    this.bot.use(async (ctx, next) => {
      // Check if user is authorized (if USER_ID is set)
      if (this.authorizedUserId && ctx.from?.id !== this.authorizedUserId) {
        this.logger.warn(`Unauthorized access attempt from user ${ctx.from?.id} (${ctx.from?.username || 'unknown'})`);
        await ctx.replyWithAnimation(process.env.YOU_SHALL_NOT_PASS!);
        return; // Stop processing
      }

      await next();
    });

    // Log all incoming messages
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      this.logger.debug(`Processing time: ${ms}ms`);
    });
  }

  private setupHandlers() {
    // Start command
    this.bot.command('start', (ctx) => {
      ctx.reply('Welcome! I am your tracker bot. Send me a message and I will process it.');
    });

    // Help command
    this.bot.command('help', (ctx) => {
      ctx.reply(
        'Available commands:\n' +
        '/start - Start the bot\n' +
        '/help - Show this help message\n' +
        '/balance - View account balances\n' +
        '/recent - View recent transactions\n' +
        '/report - View monthly expense report\n\n' +
        'You can also:\n' +
        '• Send expense messages (e.g., "Gasté 5000 pesos en comida")\n' +
        '• Send income messages (e.g., "Cobré mi sueldo 2450 EUR")\n' +
        '• Send images, voice messages, audio, or documents for AI analysis'
      );
    });

    // Expense tracking commands
    this.bot.command('balance', handleBalanceQuery);
    this.bot.command('recent', handleRecentTransactions);
    this.bot.command('report', handleMonthlyReport);

    // Handle all text messages
    this.bot.on('message:text', async (ctx) => {
      const userMessage = ctx.message.text;
      const userId = ctx.from.id;
      const username = ctx.from.username || 'unknown';

      this.logger.newline();
      this.logger.separator();
      this.logger.info(`📨 MESSAGE RECEIVED`);
      this.logger.info(`User: ${username} (${userId})`);
      this.logger.info(`Message: "${userMessage}"`);
      this.logger.separator();

      try {
        await ctx.replyWithChatAction('typing');

        // Use orchestrator to analyze intent
        this.logger.info(`🤖 CALLING ORCHESTRATOR...`);
        const decision = await this.orchestrator.analyzeIntent(userMessage);

        this.logger.info(`✅ ORCHESTRATOR RESPONSE:`);
        this.logger.info(`  Intent: ${decision.intent}`);
        this.logger.info(`  Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
        if (decision.reasoning) this.logger.info(`  Reasoning: ${decision.reasoning}`);

        // Route based on intent
        this.logger.newline();
        this.logger.info(`📍 ROUTING TO HANDLER: ${decision.intent.toUpperCase()}`);

        switch (decision.intent) {
          case 'track_expense':
          case 'track_income':
            this.logger.info(`  ├─ Calling expense/income handler...`);
            await handleExpenseMessage(ctx);
            this.logger.info(`  └─ ✅ Handler completed`);
            break;

          case 'query_balance':
            this.logger.info(`  ├─ Calling balance query handler...`);
            await handleBalanceQuery(ctx);
            this.logger.info(`  └─ ✅ Handler completed`);
            break;

          case 'query_transactions':
            this.logger.info(`  ├─ Calling recent transactions handler...`);
            await handleRecentTransactions(ctx);
            this.logger.info(`  └─ ✅ Handler completed`);
            break;

          case 'query_report':
            this.logger.info(`  ├─ Calling analytics query handler...`);
            await handleCustomReportQuery(ctx);
            this.logger.info(`  └─ ✅ Handler completed`);
            break;

          case 'archive_transaction':
            this.logger.info(`  ├─ Calling archive handler...`);
            await handleArchiveMessage(ctx);
            this.logger.info(`  └─ ✅ Handler completed`);
            break;

          case 'general_chat':
          case 'unknown':
          default:
            this.logger.info(`  ├─ Calling general chat assistant...`);
            const response = await this.textProcessor.processWithPrompt(
              userMessage,
              'chat-assistant'
            );
            await ctx.reply(response.content);
            this.logger.info(`  └─ ✅ Response sent`);
            break;
        }

        this.logger.newline();
        this.logger.separator();
        this.logger.info(`✅ MESSAGE PROCESSING COMPLETE`);
        this.logger.separator();
        this.logger.newline();
      } catch (error) {
        this.logger.error('Error processing text message:', error);
        await ctx.reply('Sorry, I encountered an error processing your message.');
      }
    });

    // Handle photos
    this.bot.on('message:photo', async (ctx) => {
      const userId = ctx.from.id;
      const username = ctx.from.username || 'unknown';
      const caption = ctx.message.caption || '';

      this.logger.info(`Received photo from ${username} (${userId})`);

      try {
        await ctx.replyWithChatAction('typing');

        // Get the highest resolution photo
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const file = await ctx.api.getFile(photo.file_id);
        const fileLink = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;

        // Download and encode image
        const imageDataUrl = await this.imageProcessor.downloadAndEncodeImage(fileLink);

        // Get appropriate prompt from Langfuse
        let prompt: string;
        if (caption) {
          const promptTemplate = await this.promptManager.getPrompt(
            'image-with-caption'
          );
          prompt = this.promptManager.compilePrompt(promptTemplate, { caption });
        } else {
          prompt = await this.promptManager.getPrompt(
            'image-description'
          );
        }

        const analysis = await this.imageProcessor.askAboutImage(imageDataUrl, prompt);

        await ctx.reply(analysis);
      } catch (error) {
        this.logger.error('Error processing image:', error);
        await ctx.reply('Sorry, I encountered an error processing your image.');
      }
    });

    // Handle voice messages
    this.bot.on('message:voice', async (ctx) => {
      const userId = ctx.from.id;
      const username = ctx.from.username || 'unknown';

      this.logger.info(`Received voice message from ${username} (${userId})`);

      try {
        await ctx.replyWithChatAction('typing');

        const file = await ctx.api.getFile(ctx.message.voice.file_id);
        const fileLink = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;

        // Get voice analysis prompt from Langfuse
        const analysisPrompt = await this.promptManager.getPrompt(
          'voice-analysis'
        );

        const result = await this.audioProcessor.processAudioFromUrl(
          fileLink,
          'voice.ogg',
          { analysisPrompt }
        );

        const reply = `🎤 Transcription:\n${result.transcription}\n\n📝 Response:\n${result.analysis || 'No analysis available.'}`;
        await ctx.reply(reply);
      } catch (error) {
        this.logger.error('Error processing voice message:', error);
        await ctx.reply('Sorry, I encountered an error processing your voice message.');
      }
    });

    // Handle audio files
    this.bot.on('message:audio', async (ctx) => {
      const userId = ctx.from.id;
      const username = ctx.from.username || 'unknown';

      this.logger.info(`Received audio from ${username} (${userId})`);

      try {
        await ctx.replyWithChatAction('typing');

        const file = await ctx.api.getFile(ctx.message.audio.file_id);
        const fileLink = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;
        const filename = ctx.message.audio.file_name || 'audio.mp3';

        const transcription = await this.audioProcessor.transcribeFromUrl(fileLink, filename);

        await ctx.reply(`🎵 Transcription:\n${transcription}`);
      } catch (error) {
        this.logger.error('Error processing audio:', error);
        await ctx.reply('Sorry, I encountered an error processing your audio file.');
      }
    });

    // Handle documents
    this.bot.on('message:document', async (ctx) => {
      const userId = ctx.from.id;
      const username = ctx.from.username || 'unknown';
      const document = ctx.message.document;

      this.logger.info(`Received document from ${username} (${userId}): ${document.file_name}`);

      try {
        await ctx.replyWithChatAction('typing');

        const file = await ctx.api.getFile(document.file_id);
        const fileLink = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;
        const mimeType = document.mime_type || 'application/octet-stream';

        // Get document analysis prompt from Langfuse
        const analysisPrompt = await this.promptManager.getPrompt(
          'document-analysis'
        );

        const result = await this.documentProcessor.processDocument(
          fileLink,
          mimeType,
          {
            analysisPrompt,
            extractText: true,
          }
        );

        let reply = '📄 Document Analysis:\n\n';
        if (result.extractedText) {
          reply += `Text extracted (${result.extractedText.length} characters)\n\n`;
        }
        if (result.analysis) {
          reply += `Summary:\n${result.analysis}`;
        }
        else {
          reply += `Extracted text:\n${result.extractedText?.substring(0, 500)}${result.extractedText && result.extractedText.length > 500 ? '...' : ''}`;
        }

        await ctx.reply(reply);
      } catch (error) {
        this.logger.error('Error processing document:', error);
        await ctx.reply(`Sorry, I encountered an error processing your document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle callback queries from inline keyboards
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      
      if (data.startsWith('complete_expense_account:')) {
        await ctx.answerCallbackQuery();
        
        const pendingTransaction = ctx.session.pendingTransaction;

        if (!pendingTransaction) {
          await ctx.editMessageText('This request has expired. Please send the transaction again.');
          return;
        }

        const accountId = parseInt(data.split(':')[1]);
        const expenseService = getExpenseTrackerService();
        const account = await expenseService.findAccountById(accountId);

        if (!account) {
          await ctx.editMessageText('Sorry, I couldn\'t find that account. Please try again.');
          return;
        }
        
        // Complete the transaction
        pendingTransaction.fromAccount = account.name;
        
        try {
          const result = await handleExpense(pendingTransaction);

          ctx.session.pendingTransaction = undefined;

          await ctx.editMessageText(formatSuccessMessage(pendingTransaction.type, result));
        } catch (error) {
          this.logger.error('Error completing expense from callback:', error);
          await ctx.editMessageText('❌ Sorry, there was an error saving your expense.');
        }
      } else if (data.startsWith('archive_confirm:')) {
        await ctx.answerCallbackQuery();
        const transactionId = parseInt(data.split(':')[1]);
        const expenseService = getExpenseTrackerService();
        try {
          await expenseService.archiveTransaction(transactionId);
          await ctx.editMessageText(`✅ Transaction ID ${transactionId} has been archived.`);
        } catch (error) {
          this.logger.error('Error confirming archive from callback:', error);
          await ctx.editMessageText('❌ Sorry, there was an error archiving the transaction.');
        }
      } else if (data.startsWith('archive_select:')) {
        await ctx.answerCallbackQuery();
        const transactionId = parseInt(data.split(':')[1]);
        const expenseService = getExpenseTrackerService();
        try {
          await expenseService.archiveTransaction(transactionId);
          await ctx.editMessageText(`✅ Transaction ID ${transactionId} has been archived.`);
        } catch (error) {
          this.logger.error('Error selecting and archiving from callback:', error);
          await ctx.editMessageText('❌ Sorry, there was an error archiving the selected transaction.');
        }
            } else if (data === 'archive_cancel') {
              await ctx.answerCallbackQuery();
              await ctx.editMessageText('Archiving cancelled.');
            }
    });

    // Handle errors
    this.bot.catch((err) => {
      this.logger.error('Bot error:', err);
    });
  }

  public async launch() {
    try {
      await this.bot.start();
      this.logger.info('Telegram bot started successfully');

      // Enable graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
    } catch (error) {
      this.logger.error('Failed to launch bot:', error);
      throw error;
    }
  }

  public async stop(signal: string) {
    this.logger.info(`Received ${signal}, stopping bot...`);
    await this.bot.stop();
  }

  public getBot(): Bot<MyContext> {
    return this.bot;
  }
}
