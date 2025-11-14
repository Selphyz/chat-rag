import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface LogContext {
  [key: string]: any;
}

@Injectable()
export class LoggerService {
  private isDevelopment: boolean;

  constructor(private configService: ConfigService) {
    this.isDevelopment =
      this.configService.get<string>('nodeEnv') === 'development';
  }

  private formatMessage(
    level: string,
    context: string,
    message: string,
    data?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const levelColor = this.getLevelColor(level);
    const contextStr = context ? `[${context}]` : '';
    const dataStr = data && Object.keys(data).length > 0 ? JSON.stringify(data) : '';

    return `${timestamp} ${levelColor} ${level.padEnd(7)} ${contextStr} ${message} ${dataStr}`;
  }

  private getLevelColor(level: string): string {
    if (!this.isDevelopment) return '';

    const colors = {
      LOG: '\x1b[36m', // Cyan
      DEBUG: '\x1b[35m', // Magenta
      INFO: '\x1b[32m', // Green
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[41m', // Red background
    };

    return colors[level] || '';
  }

  private resetColor(): string {
    return this.isDevelopment ? '\x1b[0m' : '';
  }

  log(message: string, context?: string, data?: LogContext): void {
    const formatted = this.formatMessage('LOG', context || '', message, data);
    console.log(`${formatted}${this.resetColor()}`);
  }

  debug(message: string, context?: string, data?: LogContext): void {
    if (!this.isDevelopment) return;
    const formatted = this.formatMessage('DEBUG', context || '', message, data);
    console.debug(`${formatted}${this.resetColor()}`);
  }

  info(message: string, context?: string, data?: LogContext): void {
    const formatted = this.formatMessage('INFO', context || '', message, data);
    console.info(`${formatted}${this.resetColor()}`);
  }

  warn(message: string, context?: string, data?: LogContext): void {
    const formatted = this.formatMessage('WARN', context || '', message, data);
    console.warn(`${formatted}${this.resetColor()}`);
  }

  error(
    message: string,
    context?: string,
    error?: Error | string,
    data?: LogContext,
  ): void {
    const errorStr =
      error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : String(error || '');
    const formatted = this.formatMessage('ERROR', context || '', message, data);
    console.error(`${formatted}${this.resetColor()}`);
    if (errorStr) console.error(errorStr);
  }

  fatal(message: string, context?: string, data?: LogContext): void {
    const formatted = this.formatMessage('FATAL', context || '', message, data);
    console.error(`${formatted}${this.resetColor()}`);
  }
}
