import { MyContext } from '../bot';
import { getExpenseTrackerService } from '../../services/expense-tracker.service';
import { getLogger } from '../../services/logger.service';
import { InlineKeyboard } from 'grammy';
import { TransactionDetailed } from '../../types';

export async function handleArchiveMessage(ctx: MyContext) {
  try {
    const messageText = ctx.message?.text;
    if (!messageText) {
      await ctx.reply('Please specify which transaction you would like to archive.');
      return;
    }

    await ctx.replyWithChatAction('typing');

    const expenseService = getExpenseTrackerService();

    const descriptionToSearch = extractDescriptionForArchiving(messageText);

    if (!descriptionToSearch) {
      await ctx.reply('Please specify which transaction you would like to archive.');
      return;
    }

    const matchingTransactions = await expenseService.findTransactionsByDescription(descriptionToSearch);

    if (matchingTransactions.length === 0) {
      await ctx.reply(`No non-archived transaction found matching "${descriptionToSearch}".`);
      return;
    }

    if (matchingTransactions.length === 1) {
      const transaction = matchingTransactions[0];
      const keyboard = new InlineKeyboard()
        .text('Yes', `archive_confirm:${transaction.id}`)
        .text('No', 'archive_cancel');

      await ctx.reply(
        `Are you sure you want to archive this transaction?\n\n` +
        `📝 ${transaction.description}\n` +
        `💵 ${transaction.to_amount} ${transaction.to_currency} on ${transaction.date.toLocaleDateString()}`,
        { reply_markup: keyboard }
      );
    } else {
      // Multiple matches
      let message = `I found multiple transactions matching "${descriptionToSearch}". Please select one to archive:\n\n`;
      const keyboard = new InlineKeyboard();

      matchingTransactions.forEach((transaction, index) => {
        message += `${index + 1}. ${transaction.description} (${transaction.to_amount} ${transaction.to_currency} on ${transaction.date.toLocaleDateString()})\n`;
        keyboard.text(`${index + 1}`, `archive_select:${transaction.id}`);
        if ((index + 1) % 2 === 0) keyboard.row(); // 2 buttons per row
      });

      await ctx.reply(message, { reply_markup: keyboard });
    }

  } catch (error) {
    const logger = getLogger();
    logger.error('Error handling archive message:', error);
    await ctx.reply(`❌ Error processing your archive request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper to extract description. This needs refinement.
function extractDescriptionForArchiving(message: string): string | null {
  // Simple heuristic for now: assume user says "delete [description]" or "archive [description]"
  const match = message.match(/(?:delete|archive)\s+(?:the\s+)?(.*)(?:\s+expense)?/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return message; // Fallback to entire message if no specific pattern
}
