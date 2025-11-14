# Step 4: Ollama Integration for LLM

**Estimated Time:** 2 hours
**Prerequisites:** Steps 1-3 completed, Ollama running in Docker

---

## Overview

In this step, we'll integrate Ollama for LLM capabilities:
- Create Ollama service wrapper
- Implement chat completion functionality
- Add embedding generation
- Test with Llama 3.2 model
- Error handling and retry logic

---

## 1. Install Dependencies

```bash
npm install ollama
```

*Note: The `ollama` package provides a TypeScript client for Ollama's API*

---

## 2. Ollama Service

### 2.1 Create Ollama Service - `src/modules/ollama/ollama.service.ts`

```typescript
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama } from 'ollama';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private ollama: Ollama;
  private model: string;
  private embeddingModel: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('ollama.host');
    this.model = this.configService.get<string>('ollama.model');
    this.embeddingModel = this.configService.get<string>(
      'ollama.embeddingModel',
    );

    this.ollama = new Ollama({ host });
    this.logger.log(`Ollama service initialized with host: ${host}`);
  }

  /**
   * Generate chat completion
   */
  async chat(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<string> {
    try {
      this.logger.debug(`Generating chat completion with ${messages.length} messages`);

      const response = await this.ollama.chat({
        model: this.model,
        messages: messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 0.9,
          num_predict: options?.maxTokens ?? 2000,
        },
      });

      return response.message.content;
    } catch (error) {
      this.logger.error(`Chat completion error: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to generate chat response',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Generate chat completion with streaming (for future use)
   */
  async *chatStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string> {
    try {
      const response = await this.ollama.chat({
        model: this.model,
        messages: messages,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 0.9,
          num_predict: options?.maxTokens ?? 2000,
        },
      });

      for await (const part of response) {
        if (part.message?.content) {
          yield part.message.content;
        }
      }
    } catch (error) {
      this.logger.error(`Chat stream error: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to stream chat response',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      this.logger.debug(`Generating embedding for text of length ${text.length}`);

      const response = await this.ollama.embeddings({
        model: this.embeddingModel,
        prompt: text,
      });

      return response.embedding;
    } catch (error) {
      this.logger.error(`Embedding generation error: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to generate embedding',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      this.logger.debug(`Generating embeddings for ${texts.length} texts`);

      const embeddings = await Promise.all(
        texts.map((text) => this.generateEmbedding(text)),
      );

      return embeddings;
    } catch (error) {
      this.logger.error(`Batch embedding error: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to generate embeddings',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Check if Ollama service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const models = await this.ollama.list();
      const hasModel = models.models.some((m) => m.name.includes(this.model));
      const hasEmbeddingModel = models.models.some((m) =>
        m.name.includes(this.embeddingModel),
      );

      if (!hasModel) {
        this.logger.warn(`Model ${this.model} not found`);
        return false;
      }

      if (!hasEmbeddingModel) {
        this.logger.warn(`Embedding model ${this.embeddingModel} not found`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.ollama.list();
      return response.models.map((m) => m.name);
    } catch (error) {
      this.logger.error(`List models error: ${error.message}`);
      throw new HttpException(
        'Failed to list models',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Pull a model (useful for initialization)
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      this.logger.log(`Pulling model: ${modelName}`);
      await this.ollama.pull({ model: modelName, stream: false });
      this.logger.log(`Model ${modelName} pulled successfully`);
    } catch (error) {
      this.logger.error(`Pull model error: ${error.message}`);
      throw new HttpException(
        'Failed to pull model',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get current model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get embedding model name
   */
  getEmbeddingModel(): string {
    return this.embeddingModel;
  }
}
```

---

## 3. Ollama Module

### 3.1 Create Ollama Module - `src/modules/ollama/ollama.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { OllamaService } from './ollama.service';

@Module({
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {}
```

---

## 4. Health Check Integration

### 4.1 Update App Controller - `src/app.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';
import { OllamaService } from './modules/ollama/ollama.service';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private dataSource: DataSource,
    private readonly ollamaService: OllamaService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  async healthCheck() {
    const isDbConnected = this.dataSource.isInitialized;
    const isOllamaHealthy = await this.ollamaService.healthCheck();

    return {
      status: isDbConnected && isOllamaHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: isDbConnected ? 'connected' : 'disconnected',
        ollama: isOllamaHealthy ? 'healthy' : 'unhealthy',
      },
    };
  }

  @Public()
  @Get('health/db')
  async databaseHealth() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      };
    }
  }

  @Public()
  @Get('health/ollama')
  async ollamaHealth() {
    try {
      const isHealthy = await this.ollamaService.healthCheck();
      const models = await this.ollamaService.listModels();

      return {
        status: isHealthy ? 'ok' : 'error',
        models: models,
        currentModel: this.ollamaService.getModel(),
        embeddingModel: this.ollamaService.getEmbeddingModel(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}
```

### 4.2 Update App Module to import OllamaModule

Update `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { OllamaModule } from './modules/ollama/ollama.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.user'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('nodeEnv') === 'development',
        logging: configService.get('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ChatModule,
    DocumentsModule,
    OllamaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
```

---

## 5. Testing Ollama Service

### 5.1 Manual Testing

Create a test controller for development:

`src/modules/ollama/ollama.controller.ts`:

```typescript
import { Controller, Post, Body, Get } from '@nestjs/common';
import { OllamaService, ChatMessage } from './ollama.service';

class TestChatDto {
  message: string;
}

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Post('test-chat')
  async testChat(@Body() dto: TestChatDto) {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: dto.message,
      },
    ];

    const response = await this.ollamaService.chat(messages);

    return {
      request: dto.message,
      response: response,
    };
  }

  @Post('test-embedding')
  async testEmbedding(@Body() dto: TestChatDto) {
    const embedding = await this.ollamaService.generateEmbedding(dto.message);

    return {
      text: dto.message,
      embeddingDimension: embedding.length,
      embedding: embedding.slice(0, 10), // Show first 10 values
    };
  }

  @Get('models')
  async listModels() {
    const models = await this.ollamaService.listModels();
    return {
      models,
      currentModel: this.ollamaService.getModel(),
      embeddingModel: this.ollamaService.getEmbeddingModel(),
    };
  }
}
```

Update `ollama.module.ts` to include the controller:

```typescript
import { Module } from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { OllamaController } from './ollama.controller';

@Module({
  controllers: [OllamaController],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {}
```

### 5.2 Test Endpoints

**Check Ollama health:**
```bash
curl http://localhost:3000/api/health/ollama
```

Expected response:
```json
{
  "status": "ok",
  "models": ["llama3.2", "nomic-embed-text"],
  "currentModel": "llama3.2",
  "embeddingModel": "nomic-embed-text"
}
```

**Test chat completion:**
```bash
curl -X POST http://localhost:3000/api/ollama/test-chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "What is TypeScript?"
  }'
```

**Test embedding generation:**
```bash
curl -X POST http://localhost:3000/api/ollama/test-embedding \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "This is a test document for embedding"
  }'
```

**List available models:**
```bash
curl http://localhost:3000/api/ollama/models \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 6. Unit Tests

### 6.1 Ollama Service Test - `src/modules/ollama/ollama.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';

describe('OllamaService', () => {
  let service: OllamaService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'ollama.host': 'http://localhost:11434',
        'ollama.model': 'llama3.2',
        'ollama.embeddingModel': 'nomic-embed-text',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<OllamaService>(OllamaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return model name', () => {
    expect(service.getModel()).toBe('llama3.2');
  });

  it('should return embedding model name', () => {
    expect(service.getEmbeddingModel()).toBe('nomic-embed-text');
  });

  // Add more tests as needed for actual API calls
});
```

Run tests:
```bash
npm test ollama.service.spec.ts
```

---

## 7. Common Issues & Troubleshooting

### Issue: "Failed to fetch" or Connection Refused
**Solution:** Ensure Ollama container is running
```bash
docker-compose ps ollama
docker-compose logs ollama
```

### Issue: Models not found
**Solution:** Pull required models
```bash
docker exec -it chatrag-ollama ollama pull llama3.2
docker exec -it chatrag-ollama ollama pull nomic-embed-text
```

Verify models:
```bash
docker exec -it chatrag-ollama ollama list
```

### Issue: Slow response times
**Solution:** Ollama performance depends on hardware. Consider:
- Using GPU acceleration (requires nvidia-docker)
- Using smaller models for faster responses
- Adjusting `num_predict` (max tokens) parameter

### Issue: Out of memory errors
**Solution:** Reduce model size or allocate more resources
```yaml
# In docker-compose.yml under ollama service
deploy:
  resources:
    limits:
      memory: 8G
```

### Issue: Embedding dimension mismatch
**Solution:** Verify embedding model and dimension match
```bash
# Check embedding dimension
curl -X POST http://localhost:3000/api/ollama/test-embedding \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

Update `EMBEDDING_DIMENSION` in `.env` to match actual dimension.

---

## 8. Performance Optimization

### 8.1 Caching Frequent Requests

For production, consider implementing caching:

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class OllamaService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    // ... other dependencies
  ) {}

  async chatWithCache(
    messages: ChatMessage[],
    cacheKey?: string,
  ): Promise<string> {
    if (cacheKey) {
      const cached = await this.cacheManager.get<string>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const response = await this.chat(messages);

    if (cacheKey) {
      await this.cacheManager.set(cacheKey, response, 3600); // 1 hour
    }

    return response;
  }
}
```

### 8.2 Batch Embedding Generation

The service already supports batch embeddings with `generateEmbeddings()`. Use this for processing multiple documents:

```typescript
const texts = ['text1', 'text2', 'text3'];
const embeddings = await ollamaService.generateEmbeddings(texts);
```

---

## 9. Advanced Configuration

### 9.1 Model Parameters

Adjust generation parameters for different use cases:

```typescript
// Creative writing
await ollamaService.chat(messages, {
  temperature: 0.9,
  topP: 0.95,
  maxTokens: 3000,
});

// Factual responses
await ollamaService.chat(messages, {
  temperature: 0.3,
  topP: 0.5,
  maxTokens: 1000,
});
```

### 9.2 GPU Acceleration (Optional)

If you have NVIDIA GPU, update `docker-compose.yml`:

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: chatrag-ollama
  runtime: nvidia
  environment:
    - NVIDIA_VISIBLE_DEVICES=all
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

---

## 10. Next Steps

✅ **Step 4 Complete! You should now have:**
- Ollama service integrated with NestJS
- Chat completion functionality
- Embedding generation for vector search
- Health checks for Ollama
- Test endpoints for validation

**Continue to Step 5:** Qdrant Integration for Vector Storage

---

## Quick Commands Reference

```bash
# Check Ollama health
curl http://localhost:3000/api/health/ollama

# Test chat
curl -X POST http://localhost:3000/api/ollama/test-chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message":"Hello!"}'

# Test embedding
curl -X POST http://localhost:3000/api/ollama/test-embedding \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message":"Test text"}'

# Pull models manually
docker exec -it chatrag-ollama ollama pull llama3.2
docker exec -it chatrag-ollama ollama pull nomic-embed-text

# List models
docker exec -it chatrag-ollama ollama list

# Test Ollama directly
docker exec -it chatrag-ollama ollama run llama3.2 "Hello!"

# Check Ollama logs
docker-compose logs -f ollama
```
