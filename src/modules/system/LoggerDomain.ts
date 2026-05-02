import { prisma } from '../../../lib/prisma';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  TRADE = 'TRADE',
  SYSTEM = 'SYSTEM'
}

export class LoggerDomain {
  /**
   * Log an event both to console and the database for observability.
   */
  public static async log(level: LogLevel, message: string, meta?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const formattedMeta = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
    
    console.log(`[${timestamp}] [${level}] ${message}${formattedMeta}`);

    try {
      await (prisma as any).activityLog.create({
        data: {
          type: level,
          message: message,
          createdAt: new Date()
        }
      });
    } catch (e) {
      // Don't crash if DB logging fails
      console.error(`❌ [LOGGER] Failed to save log to DB: ${e}`);
    }
  }

  public static async info(msg: string, meta?: any) { await this.log(LogLevel.INFO, msg, meta); }
  public static async warn(msg: string, meta?: any) { await this.log(LogLevel.WARN, msg, meta); }
  public static async error(msg: string, meta?: any) { await this.log(LogLevel.ERROR, msg, meta); }
  public static async trade(msg: string, meta?: any) { await this.log(LogLevel.TRADE, msg, meta); }
}
