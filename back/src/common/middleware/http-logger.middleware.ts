import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;

    // Log incoming request
    this.logger.debug(
      `Incoming ${method} request`,
      'HttpLogger',
      {
        method,
        url: originalUrl,
        ip,
        userAgent: headers['user-agent'],
      },
    );

    // Capture response
    const originalSend = res.send;
    res.send = function (data: any): Response {
      const statusCode = res.statusCode;
      const duration = Date.now() - startTime;

      // Log response
      const logLevel = statusCode >= 400 ? 'warn' : 'info';
      const logFn =
        logLevel === 'warn' ? this.logger.warn.bind(this.logger) : this.logger.info.bind(this.logger);

      logFn(`${method} ${originalUrl}`, 'HttpLogger', {
        method,
        url: originalUrl,
        statusCode,
        duration: `${duration}ms`,
        ip,
        contentLength: res.getHeader('content-length'),
      });

      return originalSend.call(this, data);
    }.bind(this);

    next();
  }
}
