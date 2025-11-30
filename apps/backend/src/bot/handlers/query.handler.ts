import type { MyContext } from '../bot';
import { getExpenseTrackerService } from '../../services/expense-tracker.service';
import { getAnalyticsService } from '../../services/analytics.service';
import { getLogger } from '../../services/logger.service';

export async function handleBalanceQuery(ctx: MyContext) {
  const logger = getLogger();

  try {
    logger.info(`    ├─ 📊 Fetching account balances...`);
    await ctx.replyWithChatAction('typing');

    const expenseService = getExpenseTrackerService();
    const balances = await expenseService.getAllAccountBalances();
    logger.info(`    ├─ ✅ Retrieved ${balances.length} account balances`);

    let message = '💰 *Account Balances*\n\n';

    for (const balance of balances) {
      const emoji = balance.balance >= 0 ? '✅' : '❌';
      message += `${emoji} *${balance.account_name}*\n`;
      message += `   ${balance.balance.toLocaleString()} ${balance.currency}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
    logger.info(`    └─ ✅ Balance report sent to user`);

  } catch (error) {
    logger.error('    └─ ❌ Error getting balances:', error);
    await ctx.reply('❌ Error retrieving balances');
  }
}

export async function handleRecentTransactions(ctx: MyContext) {
  const logger = getLogger();

  try {
    logger.info(`    ├─ 📋 Fetching recent transactions...`);
    await ctx.replyWithChatAction('typing');

    const expenseService = getExpenseTrackerService();
    const transactions = await expenseService.getRecentTransactions(10);
    logger.info(`    ├─ ✅ Retrieved ${transactions.length} transactions`);

    if (transactions.length === 0) {
      await ctx.reply('No recent transactions found.');
      return;
    }

    let message = '📊 *Recent Transactions*\n\n';

    for (const tx of transactions) {
      const typeEmoji = {
        income: '💰',
        transfer: '↔️',
        expense: '💸',
        credit_card_payment: '💳'
      }[tx.type] || '📝';

      message += `${typeEmoji} *${tx.description}*\n`;
      message += `   ${tx.to_amount} ${tx.to_currency}`;

      if (tx.from_account_name) {
        message += ` from ${tx.from_account_name}`;
      }
      if (tx.to_account_name) {
        message += ` to ${tx.to_account_name}`;
      }
      if (tx.category_name) {
        message += ` (${tx.category_name})`;
      }

      message += `\n   ${tx.date.toLocaleDateString()}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
    logger.info(`    └─ ✅ Transactions list sent to user`);

  } catch (error) {
    logger.error('    └─ ❌ Error getting transactions:', error);
    await ctx.reply('❌ Error retrieving transactions');
  }
}

export async function handleMonthlyReport(ctx: MyContext) {
  const logger = getLogger();

  try {
    await ctx.replyWithChatAction('typing');

    const expenseService = getExpenseTrackerService();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const expenses = await expenseService.getExpensesByCategory(startOfMonth, endOfMonth);
    const totals = await expenseService.getTotalExpenses(startOfMonth, endOfMonth);

    let message = `📊 *Monthly Report - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}*\n\n`;

    // Total expenses
    message += '*Total Expenses:*\n';
    if (totals.length > 0) {
      for (const total of totals) {
        message += `   ${total.total.toLocaleString()} ${total.currency}\n`;
      }
    } else {
      message += '   No expenses this month\n';
    }
    message += '\n';

    // By category
    if (expenses.length > 0) {
      message += '*By Category:*\n';
      for (const expense of expenses) {
        message += `   ${expense.category_name}: ${expense.total_amount.toLocaleString()} ${expense.currency}\n`;
      }
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Error generating report:', error);
    await ctx.reply('❌ Error generating monthly report');
  }
}

export async function handleCustomReportQuery(ctx: MyContext) {
  const logger = getLogger();

  try {
    const messageText = ctx.message?.text;
    if (!messageText) return;

    logger.info(`    ├─ 🔍 Processing analytics query: "${messageText}"`);
    await ctx.replyWithChatAction('typing');

    const analyticsService = getAnalyticsService();
    const result = await analyticsService.processNaturalLanguageQuery(messageText);

    await ctx.reply(result, { parse_mode: 'Markdown' });
    logger.info(`    └─ ✅ Analytics report sent to user`);

  } catch (error) {
    logger.error('    └─ ❌ Error handling custom report query:', error);
    await ctx.reply(`❌ Error processing your query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
