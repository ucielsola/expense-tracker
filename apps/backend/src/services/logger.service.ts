/**
 * Logging Service
 *
 * Centralized logging with support for different log levels and environments.
 * Provides consistent formatting and can be easily extended for file/external logging.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export class LoggerService {
  private currentLevel: LogLevel;
  private enableColors: boolean;
  private enableTimestamps: boolean;

  constructor(config?: {
    level?: LogLevel;
    enableColors?: boolean;
    enableTimestamps?: boolean;
  }) {
    // Get log level from environment or default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    const defaultLevel = envLevel && LogLevel[envLevel as keyof typeof LogLevel] !== undefined
      ? LogLevel[envLevel as keyof typeof LogLevel]
      : LogLevel.INFO;

    this.currentLevel = config?.level ?? defaultLevel;
    this.enableColors = config?.enableColors ?? true;
    this.enableTimestamps = config?.enableTimestamps ?? false;
  }

  /**
   * Set the current log level
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Debug level - detailed information for debugging
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Info level - general informational messages
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Warn level - warning messages
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Error level - error messages
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level < this.currentLevel) {
      return; // Skip if below current log level
    }

    const timestamp = this.enableTimestamps ? `[${new Date().toISOString()}] ` : '';
    const levelStr = this.getLevelString(level);
    const formattedMessage = `${timestamp}${levelStr}${message}`;

    // Choose console method based on level
    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
    }
  }

  /**
   * Get formatted level string
   */
  private getLevelString(level: LogLevel): string {
    if (!this.enableColors) {
      switch (level) {
        case LogLevel.DEBUG: return '[DEBUG] ';
        case LogLevel.INFO: return '[INFO] ';
        case LogLevel.WARN: return '[WARN] ';
        case LogLevel.ERROR: return '[ERROR] ';
        default: return '';
      }
    }

    // With colors (ANSI codes)
    const RESET = '\x1b[0m';
    const GRAY = '\x1b[90m';
    const BLUE = '\x1b[34m';
    const YELLOW = '\x1b[33m';
    const RED = '\x1b[31m';

    switch (level) {
      case LogLevel.DEBUG: return `${GRAY}[DEBUG]${RESET} `;
      case LogLevel.INFO: return `${BLUE}[INFO]${RESET} `;
      case LogLevel.WARN: return `${YELLOW}[WARN]${RESET} `;
      case LogLevel.ERROR: return `${RED}[ERROR]${RESET} `;
      default: return '';
    }
  }

  /**
   * Log a separator line
   */
  separator(char: string = '=', length: number = 80): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log(char.repeat(length));
    }
  }

  /**
   * Log an empty line
   */
  newline(): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log('');
    }
  }
}

// Singleton instance
let instance: LoggerService | null = null;

export function getLogger(): LoggerService {
  if (!instance) {
    instance = new LoggerService();
  }
  return instance;
}
