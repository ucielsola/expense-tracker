import { MyContext } from '../bot';
import { InlineKeyboard } from 'grammy';
import { getExpenseTrackerService } from '../../services/expense-tracker.service';
import { getTextProcessor } from '../../services/text-processor';
import { getPromptManager } from '../../services/prompt-manager';
import { getLogger } from '../../services/logger.service';
import {
  ExpenseParserSchema,
  getExpenseParserJSONSchema,
  type ExpenseParserResult
} from '../../schemas';
import type { Currency } from '../../types';
import { ZodError } from 'zod';

export async function handleExpenseMessage(ctx: MyContext) {
  const logger = getLogger();

  try {
    const messageText = ctx.message?.text;
    if (!messageText) return;

    await ctx.replyWithChatAction('typing');

    logger.info(`  ├─ 🤖 CALLING EXPENSE PARSER...`);

    const promptManager = getPromptManager();
    const promptData = await promptManager.getPromptWithConfig(
      'expense-parser',
      { config: { schema: getExpenseParserJSONSchema() } }
    );

    const schema = promptData.config?.schema || getExpenseParserJSONSchema();
    const textProcessor = getTextProcessor();
    let parsed: ExpenseParserResult;

    try {
      parsed = await textProcessor.extractStructured<ExpenseParserResult>(
        messageText,
        promptData.prompt,
        { name: 'expense_parser', schema: schema },
        ExpenseParserSchema
      );

      logger.info(`  ├─ ✅ EXPENSE PARSER SUCCESS:`);
      logger.info(`  │  ├─ Type: ${parsed.type}`);
      logger.info(`  │  ├─ Description: ${parsed.description}`);
      logger.info(`  │  ├─ Amount: ${parsed.amount} ${parsed.currency}`);
      logger.info(`  │  ├─ Confidence: ${parsed.confidence}%`);
      if (parsed.fromAccount) logger.info(`  │  ├─ From: ${parsed.fromAccount}`);
      if (parsed.toAccount) logger.info(`  │  ├─ To: ${parsed.toAccount}`);
      if (parsed.category) logger.info(`  │  ├─ Category: ${parsed.category}`);
      if (parsed.installments && parsed.installments > 1) logger.info(`  │  └─ Installments: ${parsed.installments}`);
    } catch (extractError) {
      logger.error('  ├─ ❌ EXPENSE PARSER FAILED:', extractError);
      await ctx.reply('❌ Could not understand the transaction format. Please try again with more details.');
      return;
    }

    if (parsed.confidence < 50) {
      logger.warn(`  ├─ ⚠️  LOW CONFIDENCE: ${parsed.confidence}% - Asking user for clarification`);
      await ctx.reply(`❓ I'm not confident about this transaction (${parsed.confidence}% confidence). Can you provide more details?`);
      return;
    }
    
    // =================================================================
    // INTERACTIVE VALIDATION
    // =================================================================
    if (parsed.type === 'expense' && !parsed.fromAccount) {
      logger.warn(`  ├─ ⚠️  MISSING ACCOUNT - Requesting user selection`);
      const expenseService = getExpenseTrackerService();
      const accounts = await expenseService.getAllAccounts();

      if (accounts.length > 0) {
        ctx.session.pendingTransaction = parsed;

        const keyboard = new InlineKeyboard();
        accounts.forEach(acc => {
          keyboard.text(acc.name, `complete_expense_account:${acc.id}`).row();
        });

        await ctx.reply(`I see you spent ${parsed.amount} ${parsed.currency} on "${parsed.description}".\nWhich account did you use?`, {
          reply_markup: keyboard
        });
        logger.info(`  └─ 🔄 Waiting for account selection via inline keyboard`);
        return; // Stop processing until user provides the account
      }
    }
    // =================================================================

    logger.info(`  ├─ 💾 SAVING TO DATABASE...`);
    let result;

    try {
      switch (parsed.type) {
        case 'income':
          result = await handleIncome(parsed);
          break;
        case 'transfer':
          result = await handleTransfer(parsed);
          break;
        case 'expense':
          result = await handleExpense(parsed);
          break;
        case 'credit_card_payment':
          result = await handleCreditCardPayment(parsed);
          break;
        case 'credit_card_purchase':
          result = await handleCreditCardPurchase(parsed);
          break;
        default:
          throw new Error(`Unknown transaction type: ${parsed.type}`);
      }

      logger.info(`  └─ ✅ SAVED TO DATABASE`);
      logger.info(`     Transaction ID: ${Array.isArray(result) ? `${result.length} installments created` : result.id}`);
    } catch (dbError) {
      logger.error(`  └─ ❌ DATABASE ERROR:`, dbError);
      throw dbError;
    }

    await ctx.reply(formatSuccessMessage(parsed.type, result));

  } catch (error) {
    logger.error('Error handling expense message:', error);
    await ctx.reply(`❌ Error processing transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleIncome(parsed: any) {
  const expenseService = getExpenseTrackerService();
  const account = await expenseService.findAccountByName(parsed.toAccount);
  if (!account) throw new Error(`Account not found: ${parsed.toAccount}`);

  return expenseService.recordIncome({
    date: new Date(parsed.date),
    description: parsed.description,
    accountId: account.id,
    amount: parsed.amount,
    currency: parsed.currency as Currency
  });
}

async function handleTransfer(parsed: any) {
  const expenseService = getExpenseTrackerService();
  const fromAccount = await expenseService.findAccountByName(parsed.fromAccount);
  const toAccount = await expenseService.findAccountByName(parsed.toAccount);

  if (!fromAccount) throw new Error(`From account not found: ${parsed.fromAccount}`);
  if (!toAccount) throw new Error(`To account not found: ${parsed.toAccount}`);

  // For transfers, we need both amounts
  // If only one amount is provided, assume same amount
  const fromAmount = parsed.fromAmount || parsed.amount;
  const toAmount = parsed.toAmount || parsed.amount;

  return expenseService.recordTransfer({
    date: new Date(parsed.date),
    description: parsed.description,
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    fromAmount,
    toAmount
  });
}

export async function handleExpense(parsed: any) {
  const expenseService = getExpenseTrackerService();
  const account = await expenseService.findAccountByName(parsed.fromAccount);
  const category = await expenseService.findCategoryByName(parsed.category);

  if (!account) throw new Error(`Account not found: ${parsed.fromAccount}`);
  if (!category) throw new Error(`Category not found: ${parsed.category}`);

  return expenseService.recordExpense({
    date: new Date(parsed.date),
    description: parsed.description,
    accountId: account.id,
    amount: parsed.amount,
    categoryId: category.id
  });
}

async function handleCreditCardPayment(parsed: any) {
  const expenseService = getExpenseTrackerService();
  const fromAccount = await expenseService.findAccountByName(parsed.fromAccount);
  const creditCard = await expenseService.findAccountByName(parsed.toAccount);

  if (!fromAccount) throw new Error(`From account not found: ${parsed.fromAccount}`);
  if (!creditCard) throw new Error(`Credit card not found: ${parsed.toAccount}`);

  return expenseService.recordCreditCardPayment(
    fromAccount.id,
    creditCard.id,
    parsed.amount,
    new Date(parsed.date),
    parsed.description
  );
}

async function handleCreditCardPurchase(parsed: any) {
  const expenseService = getExpenseTrackerService();
  const creditCard = await expenseService.findAccountByName(
    parsed.toAccount || 'BBVA Credit Card'
  );

  if (!creditCard) throw new Error(`Credit card not found`);

  const category = parsed.category
    ? await expenseService.findCategoryByName(parsed.category)
    : null;

  return expenseService.recordCreditCardPurchase({
    creditCardAccountId: creditCard.id,
    date: new Date(parsed.date),
    description: parsed.description,
    totalAmount: parsed.amount,
    currency: parsed.currency as Currency,
    categoryId: category?.id,
    totalInstallments: parsed.installments || 1
  });
}

export function formatSuccessMessage(type: string, result: any): string {
  const icons = {
    income: '💰',
    transfer: '↔️',
    expense: '💸',
    credit_card_payment: '💳',
    credit_card_purchase: '🛍️'
  };

  const icon = icons[type as keyof typeof icons] || '✅';

  if (Array.isArray(result)) {
    // Credit card purchase with installments
    const first = result[0];
    return `${icon} Credit card purchase recorded!\n\n` +
           `📝 ${first.description}\n` +
           `💵 ${first.amount} ${first.currency} x ${result.length} installments\n` +
           `📅 Starting ${first.date.toLocaleDateString()}`;
  } else {
    return `${icon} Transaction recorded!\n\n` +
           `📝 ${result.description}\n` +
           `💵 ${result.to_amount} ${result.to_currency}\n` +
           `📅 ${result.date.toLocaleDateString()}`;
  }
}
