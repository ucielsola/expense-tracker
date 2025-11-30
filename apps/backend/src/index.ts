// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Now import everything else
import { TelegramBot } from './bot/bot';
import { testConnection, closePool } from './database/connection';
import { getLangfuseClient } from './services/langfuse-client';
import { getLogger } from './services/logger.service';

async function main() {
  const logger = getLogger();

  try {
    // Validate required environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
    }

    logger.info('Starting Tracker v2...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.warn('Warning: Database connection failed. Continuing without database...');
    }

    // Initialize Langfuse (optional)
    const langfuse = getLangfuseClient();
    if (langfuse.isEnabled()) {
      logger.info('Langfuse observability enabled');
    }

    // Initialize and launch bot
    const bot = new TelegramBot(botToken);
    await bot.launch();

    logger.info('System is ready!');
  } catch (error) {
    logger.error('Fatal error during startup:', error);
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  const logger = getLogger();
  logger.info('Cleaning up...');
  const langfuse = getLangfuseClient();
  if (langfuse.isEnabled()) {
    await langfuse.shutdown();
  }
  await closePool();
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = getLogger();
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
main();
