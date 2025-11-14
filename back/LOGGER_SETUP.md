# Logger Configuration Setup

This guide explains the logging system configured for the Chat RAG Backend application.

## Overview

A comprehensive logger has been configured to automatically log all HTTP requests and responses in development mode. This helps with debugging, monitoring, and understanding the request/response flow.

## What Was Added

### 1. **LoggerService** (`src/common/logger/logger.service.ts`)
- Core logging service with multiple log levels: `log()`, `debug()`, `info()`, `warn()`, `error()`, `fatal()`
- Color-coded output in development mode (Cyan, Green, Yellow, Red, Magenta)
- Structured logging with context and data
- Automatic timestamps
- Environment-aware (dev vs production)

### 2. **HttpLoggerMiddleware** (`src/common/middleware/http-logger.middleware.ts`)
- Automatically logs all HTTP requests and responses
- Captures: method, URL, status code, duration, IP, user agent
- Color-codes responses (warn for 4xx/5xx, info for 2xx/3xx)
- Calculates request duration in milliseconds

### 3. **CommonModule** (`src/common/common.module.ts`)
- Exports `LoggerService` for use across the application
- Can be imported in any module that needs logging

### 4. **Updated AppModule** (`src/app.module.ts`)
- Registers `HttpLoggerMiddleware` globally
- Provides `LoggerService`

### 5. **Updated main.ts** (`src/main.ts`)
- Uses logger to log application startup
- Shows server startup and listening confirmation

## File Structure

```
src/common/
├── common.module.ts
├── logger/
│   ├── logger.service.ts       # Main logger service
│   ├── logger.example.ts       # Usage examples (reference only)
│   └── README.md               # Logger documentation
└── middleware/
    └── http-logger.middleware.ts
```

## Usage Examples

### In Any Service

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from './common/logger/logger.service';

@Injectable()
export class ChatService {
  constructor(private logger: LoggerService) {}

  async sendMessage(chatId: string, userId: string, message: string) {
    // Log with context
    this.logger.info('Sending message', 'ChatService', {
      chatId,
      userId,
      messageLength: message.length,
    });

    try {
      // Your business logic
      const response = await this.ollama.chat(message);

      this.logger.info('Message processed', 'ChatService', {
        chatId,
        responseLength: response.length,
        duration: 1234, // ms
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to process message', 'ChatService', error, {
        chatId,
        userId,
      });
      throw error;
    }
  }
}
```

### Log Levels

| Level | Use | Dev Color |
|-------|-----|-----------|
| `log()` | General messages | Cyan |
| `debug()` | Detailed debug (dev only) | Magenta |
| `info()` | Important events | Green |
| `warn()` | Warnings | Yellow |
| `error()` | Errors | Red |
| `fatal()` | Critical | Red Background |

## HTTP Logging Output

When you make requests to your endpoints, you'll see:

```
2025-11-14T21:15:32.123Z DEBUG   [HttpLogger] Incoming POST request
  {
    method: 'POST',
    url: '/api/chats/abc123/messages',
    ip: '::1',
    userAgent: 'Postman/10.0'
  }

2025-11-14T21:15:32.456Z INFO    [HttpLogger] POST /api/chats/abc123/messages
  {
    method: 'POST',
    url: '/api/chats/abc123/messages',
    statusCode: 201,
    duration: '333ms',
    ip: '::1',
    contentLength: 2048
  }
```

## Development vs Production

### Development Mode (`NODE_ENV=development`)
- ✅ Color-coded logs
- ✅ `debug()` messages visible
- ✅ Full stack traces for errors
- ✅ HTTP request/response logging
- ✅ Structured data logged

### Production Mode (`NODE_ENV=production`)
- ✅ Plain text (no colors)
- ❌ `debug()` messages suppressed
- ✅ Stack traces for errors
- ✅ HTTP request/response logging
- ✅ Structured data logged

## Configuration

The logger uses your existing configuration:

```env
# .env file
NODE_ENV=development
```

No additional configuration needed - it works out of the box!

## Best Practices

1. **Always provide context** - Second parameter should identify the module/service:
   ```typescript
   this.logger.info('User registered', 'AuthService', { userId });
   ```

2. **Use appropriate log levels** - Don't log everything as INFO:
   ```typescript
   this.logger.debug('Query debug info', 'DB'); // Verbose, dev only
   this.logger.info('User action', 'Auth');      // Important
   this.logger.warn('Slow query', 'DB');         // Problematic
   this.logger.error('DB failed', 'DB', error);  // Error
   ```

3. **Include relevant data** - Pass objects for context:
   ```typescript
   this.logger.info('Document uploaded', 'DocumentService', {
     documentId: doc.id,
     userId: user.id,
     fileSize: file.size,
     duration: 1234
   });
   ```

4. **Never log sensitive data**:
   ```typescript
   // ❌ BAD
   this.logger.info('User', 'Auth', { password: user.password });

   // ✅ GOOD
   this.logger.info('User login', 'Auth', { userId: user.id, email: user.email });
   ```

5. **Catch and log errors properly**:
   ```typescript
   try {
     // operation
   } catch (error) {
     this.logger.error('Operation failed', 'MyService', error, {
       context: 'specific info'
     });
     throw error; // Re-throw if needed
   }
   ```

## Using in Different Modules

### Chat Module Example

```typescript
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [CommonModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
```

Then in the service:
```typescript
@Injectable()
export class ChatService {
  constructor(private logger: LoggerService) {}

  // LoggerService is now available
}
```

## Viewing Logs

### In Development

Run your app with:
```bash
npm run start:dev
```

Logs will appear in the terminal with colors and timestamps.

### In Production

To capture logs from a running Docker container:
```bash
docker-compose logs -f app
```

To pipe logs to a file:
```bash
npm run start > logs/app.log 2>&1 &
```

## Troubleshooting

### Colors not showing in terminal
- Ensure `NODE_ENV=development`
- Some terminals don't support ANSI colors, try a different one
- Colors are intentionally disabled in production

### Debug logs not appearing
- Verify `NODE_ENV=development`
- Debug logs are suppressed in production

### Missing imports in modules
- Import `CommonModule` in your module's imports array
- This exports the `LoggerService`

## Examples Reference

For detailed usage examples, see: `src/common/logger/logger.example.ts`

## Next Steps

1. Start using the logger in your services:
   ```typescript
   constructor(private logger: LoggerService) {}
   ```

2. Replace `console.log()` calls with appropriate logger methods

3. Add meaningful context to logs for better debugging

4. Review the examples file for RAG-specific logging patterns

## Performance Impact

The logging system has minimal performance impact:
- HTTP middleware only adds ~1ms overhead per request
- Debug logs are disabled in production
- Structured data is only serialized when needed

---

**Logger Service Location**: `src/common/logger/logger.service.ts`
**Documentation**: `src/common/logger/README.md`
**Examples**: `src/common/logger/logger.example.ts`
