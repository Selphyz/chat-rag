# Logger Service

The logger service provides structured logging for the NestJS application with color-coded output in development mode.

## Features

- **Color-coded logs** in development (Cyan, Green, Yellow, Red, Magenta)
- **Timestamps** on all log messages
- **Context tracking** - identify which part of the app is logging
- **Structured data** - pass objects for rich logging context
- **Environment-aware** - different behavior in development vs production
- **Automatic HTTP logging** - middleware logs all incoming requests and responses

## Usage

### Basic Logging

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from './common/logger/logger.service';

@Injectable()
export class MyService {
  constructor(private logger: LoggerService) {}

  async myMethod() {
    this.logger.log('This is a log message', 'MyService');
    this.logger.debug('This is debug info', 'MyService');
    this.logger.info('This is info', 'MyService');
    this.logger.warn('This is a warning', 'MyService');
    this.logger.error('This is an error', 'MyService', new Error('Something went wrong'));
  }
}
```

### Logging with Context Data

```typescript
this.logger.info('User logged in', 'AuthService', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});
```

### Logging Errors

```typescript
try {
  // some operation
} catch (error) {
  this.logger.error(
    'Failed to process document',
    'DocumentService',
    error,
    { documentId: doc.id }
  );
}
```

## Log Levels

| Level | Use Case | Color (Dev) |
|-------|----------|------------|
| `log()` | General messages | Cyan |
| `debug()` | Detailed debug info (dev only) | Magenta |
| `info()` | Important information | Green |
| `warn()` | Warning situations | Yellow |
| `error()` | Error cases | Red |
| `fatal()` | Critical failures | Red bg |

## HTTP Logging

The `HttpLoggerMiddleware` automatically logs:
- **Incoming requests**: Method, URL, IP, User-Agent
- **Response details**: Status code, duration, content length

Example output:
```
2025-11-14T10:15:32.123Z INFO    [HttpLogger] GET /api/chats statusCode: 200, duration: 45ms
2025-11-14T10:15:35.456Z WARN    [HttpLogger] POST /api/documents statusCode: 400, duration: 23ms
```

## Module Integration

The logger is provided in the `CommonModule` and registered globally in `AppModule`.

To use it in other modules:

```typescript
import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';

@Module({
  imports: [CommonModule],
})
export class ChatModule {}
```

## Environment-Specific Behavior

**Development mode** (`NODE_ENV=development`):
- Color-coded output
- `debug()` messages are shown
- Full error stack traces

**Production mode**:
- Plain text output (no colors)
- `debug()` messages are suppressed
- Structured logging ready for log aggregation

## Configuration

The logger automatically uses the `NODE_ENV` from your configuration. Ensure your `.env` file has:

```env
NODE_ENV=development
```

## Tips

1. Always provide a context string (2nd parameter) to identify where the log came from
2. Use appropriate log levels - don't log everything as INFO
3. In development, use `debug()` for verbose output
4. Include relevant data in the context object for debugging
5. Never log sensitive data (passwords, tokens, etc.)
