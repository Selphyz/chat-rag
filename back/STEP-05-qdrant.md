# Step 5: Qdrant Integration for Vector Storage

**Estimated Time:** 2-3 hours
**Prerequisites:** Steps 1-4 completed, Qdrant running in Docker

---

## Overview

In this step, we'll integrate Qdrant vector database:
- Install Qdrant client
- Create Qdrant service wrapper
- Initialize collections
- Implement vector operations (insert, search, delete)
- Test vector similarity search

---

## 1. Install Dependencies

```bash
npm install @qdrant/js-client-rest
```

---

## 2. Qdrant Service

### 2.1 Create Qdrant Service - `src/modules/qdrant/qdrant.service.ts`

```typescript
import { Injectable, Logger, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private collectionName: string;
  private vectorDimension: number;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('qdrant.host');
    const port = this.configService.get<number>('qdrant.port');
    this.collectionName = this.configService.get<string>('qdrant.collection');
    this.vectorDimension = this.configService.get<number>(
      'qdrant.embeddingDimension',
    );

    this.client = new QdrantClient({
      url: `http://${host}:${port}`,
    });

    this.logger.log(
      `Qdrant client initialized: http://${host}:${port}`,
    );
  }

  async onModuleInit() {
    await this.initializeCollection();
  }

  /**
   * Initialize collection if it doesn't exist
   */
  private async initializeCollection(): Promise<void> {
    try {
      const exists = await this.collectionExists();

      if (!exists) {
        this.logger.log(`Creating collection: ${this.collectionName}`);
        await this.createCollection();
        this.logger.log(`Collection ${this.collectionName} created successfully`);
      } else {
        this.logger.log(`Collection ${this.collectionName} already exists`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize collection: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Check if collection exists
   */
  async collectionExists(): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(
        (c) => c.name === this.collectionName,
      );
    } catch (error) {
      this.logger.error(`Error checking collection: ${error.message}`);
      return false;
    }
  }

  /**
   * Create collection
   */
  async createCollection(): Promise<void> {
    try {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorDimension,
          distance: 'Cosine',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create collection: ${error.message}`);
      throw new HttpException(
        'Failed to create vector collection',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Insert a single vector
   */
  async insertVector(point: VectorPoint): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: point.id,
            vector: point.vector,
            payload: point.payload,
          },
        ],
      });

      this.logger.debug(`Inserted vector with ID: ${point.id}`);
    } catch (error) {
      this.logger.error(`Failed to insert vector: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to insert vector',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Insert multiple vectors (batch)
   */
  async insertVectors(points: VectorPoint[]): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });

      this.logger.debug(`Inserted ${points.length} vectors`);
    } catch (error) {
      this.logger.error(
        `Failed to insert vectors: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to insert vectors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    vector: number[],
    limit: number = 5,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    try {
      const searchParams: any = {
        vector: vector,
        limit: limit,
      };

      if (filter) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(
        this.collectionName,
        searchParams,
      );

      return results.map((r) => ({
        id: r.id as string,
        score: r.score,
        payload: r.payload || {},
      }));
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Vector search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search by user ID (filtered search)
   */
  async searchByUser(
    vector: number[],
    userId: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    return this.search(vector, limit, {
      must: [
        {
          key: 'userId',
          match: { value: userId },
        },
      ],
    });
  }

  /**
   * Get vector by ID
   */
  async getVector(id: string): Promise<VectorPoint | null> {
    try {
      const results = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_vector: true,
      });

      if (results.length === 0) {
        return null;
      }

      const point = results[0];
      return {
        id: point.id as string,
        vector: point.vector as number[],
        payload: point.payload || {},
      };
    } catch (error) {
      this.logger.error(`Failed to get vector: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete vector by ID
   */
  async deleteVector(id: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [id],
      });

      this.logger.debug(`Deleted vector with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete vector: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to delete vector',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete multiple vectors
   */
  async deleteVectors(ids: string[]): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: ids,
      });

      this.logger.debug(`Deleted ${ids.length} vectors`);
    } catch (error) {
      this.logger.error(
        `Failed to delete vectors: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to delete vectors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete vectors by filter (e.g., all vectors for a document)
   */
  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: filter,
      });

      this.logger.debug(`Deleted vectors matching filter`);
    } catch (error) {
      this.logger.error(
        `Failed to delete by filter: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to delete vectors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete all vectors for a document
   */
  async deleteDocumentVectors(documentId: string): Promise<void> {
    await this.deleteByFilter({
      must: [
        {
          key: 'documentId',
          match: { value: documentId },
        },
      ],
    });
  }

  /**
   * Delete all vectors for a user
   */
  async deleteUserVectors(userId: string): Promise<void> {
    await this.deleteByFilter({
      must: [
        {
          key: 'userId',
          match: { value: userId },
        },
      ],
    });
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error) {
      this.logger.error(`Failed to get collection info: ${error.message}`);
      throw new HttpException(
        'Failed to get collection info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Count vectors in collection
   */
  async countVectors(filter?: Record<string, any>): Promise<number> {
    try {
      const result = await this.client.count(this.collectionName, {
        filter: filter,
        exact: false,
      });

      return result.count;
    } catch (error) {
      this.logger.error(`Failed to count vectors: ${error.message}`);
      return 0;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.length >= 0;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get collection name
   */
  getCollectionName(): string {
    return this.collectionName;
  }
}
```

---

## 3. Qdrant Module

### 3.1 Create Qdrant Module - `src/modules/qdrant/qdrant.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { QdrantService } from './qdrant.service';

@Module({
  providers: [QdrantService],
  exports: [QdrantService],
})
export class QdrantModule {}
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
import { QdrantService } from './modules/qdrant/qdrant.service';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private dataSource: DataSource,
    private readonly ollamaService: OllamaService,
    private readonly qdrantService: QdrantService,
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
    const isQdrantHealthy = await this.qdrantService.healthCheck();

    const allHealthy = isDbConnected && isOllamaHealthy && isQdrantHealthy;

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: isDbConnected ? 'connected' : 'disconnected',
        ollama: isOllamaHealthy ? 'healthy' : 'unhealthy',
        qdrant: isQdrantHealthy ? 'healthy' : 'unhealthy',
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

  @Public()
  @Get('health/qdrant')
  async qdrantHealth() {
    try {
      const isHealthy = await this.qdrantService.healthCheck();
      const collectionInfo = await this.qdrantService.getCollectionInfo();
      const vectorCount = await this.qdrantService.countVectors();

      return {
        status: isHealthy ? 'ok' : 'error',
        collection: this.qdrantService.getCollectionName(),
        vectorCount: vectorCount,
        collectionInfo: collectionInfo,
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

### 4.2 Update App Module

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
import { QdrantModule } from './modules/qdrant/qdrant.module';
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
    QdrantModule,
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

## 5. Testing Qdrant Service

### 5.1 Create Test Controller

Create `src/modules/qdrant/qdrant.controller.ts`:

```typescript
import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { QdrantService } from './qdrant.service';

class InsertTestVectorDto {
  text: string;
  metadata?: Record<string, any>;
}

class SearchTestDto {
  query: string;
  limit?: number;
}

@Controller('qdrant')
export class QdrantController {
  constructor(private readonly qdrantService: QdrantService) {}

  @Post('test-insert')
  async testInsert(@Body() dto: InsertTestVectorDto) {
    // Generate a simple test vector (normally would use Ollama)
    const vector = Array.from({ length: 768 }, () => Math.random());

    const point = {
      id: `test-${Date.now()}`,
      vector: vector,
      payload: {
        text: dto.text,
        ...dto.metadata,
      },
    };

    await this.qdrantService.insertVector(point);

    return {
      message: 'Vector inserted successfully',
      id: point.id,
    };
  }

  @Post('test-search')
  async testSearch(@Body() dto: SearchTestDto) {
    // Generate a simple test vector
    const queryVector = Array.from({ length: 768 }, () => Math.random());

    const results = await this.qdrantService.search(
      queryVector,
      dto.limit || 5,
    );

    return {
      query: dto.query,
      results: results,
    };
  }

  @Get('info')
  async getInfo() {
    const info = await this.qdrantService.getCollectionInfo();
    const count = await this.qdrantService.countVectors();

    return {
      collection: this.qdrantService.getCollectionName(),
      vectorCount: count,
      info: info,
    };
  }

  @Delete('test/:id')
  async testDelete(@Param('id') id: string) {
    await this.qdrantService.deleteVector(id);

    return {
      message: 'Vector deleted successfully',
      id: id,
    };
  }
}
```

Update `qdrant.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { QdrantService } from './qdrant.service';
import { QdrantController } from './qdrant.controller';

@Module({
  controllers: [QdrantController],
  providers: [QdrantService],
  exports: [QdrantService],
})
export class QdrantModule {}
```

### 5.2 Test Endpoints

**Check Qdrant health:**
```bash
curl http://localhost:3000/api/health/qdrant
```

Expected response:
```json
{
  "status": "ok",
  "collection": "documents_collection",
  "vectorCount": 0,
  "collectionInfo": { ... }
}
```

**Get collection info:**
```bash
curl http://localhost:3000/api/qdrant/info \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test vector insertion:**
```bash
curl -X POST http://localhost:3000/api/qdrant/test-insert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "This is a test document",
    "metadata": {
      "userId": "test-user",
      "documentId": "doc-123"
    }
  }'
```

**Test vector search:**
```bash
curl -X POST http://localhost:3000/api/qdrant/test-search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "test document",
    "limit": 5
  }'
```

**Test vector deletion:**
```bash
curl -X DELETE http://localhost:3000/api/qdrant/test/test-1234567890 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 6. Verify Qdrant via UI

Qdrant provides a web UI at `http://localhost:6333/dashboard`

You can:
- View collections
- Browse vectors
- Inspect payloads
- Run queries

---

## 7. Unit Tests

### 7.1 Qdrant Service Test - `src/modules/qdrant/qdrant.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QdrantService } from './qdrant.service';

describe('QdrantService', () => {
  let service: QdrantService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'qdrant.host': 'localhost',
        'qdrant.port': 6333,
        'qdrant.collection': 'test_collection',
        'qdrant.embeddingDimension': 768,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QdrantService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<QdrantService>(QdrantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return collection name', () => {
    expect(service.getCollectionName()).toBe('test_collection');
  });

  // Add more tests as needed
});
```

---

## 8. Common Issues & Troubleshooting

### Issue: Collection not created
**Solution:** Check Qdrant logs
```bash
docker-compose logs qdrant
```

Manually verify via API:
```bash
curl http://localhost:6333/collections
```

### Issue: Vector dimension mismatch
**Error:** `"Wrong input: Vector dimension error"`

**Solution:** Ensure embedding dimension matches collection configuration
```bash
# Check your embedding dimension
curl -X POST http://localhost:3000/api/ollama/test-embedding \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# Update EMBEDDING_DIMENSION in .env to match
```

### Issue: Connection refused
**Solution:** Verify Qdrant is running
```bash
docker-compose ps qdrant
curl http://localhost:6333/health
```

### Issue: Slow search performance
**Solution:**
- Index your collection (automatic in Qdrant)
- Reduce search limit
- Add filters to narrow search scope

### Issue: Memory usage too high
**Solution:** Configure Qdrant memory settings in `docker-compose.yml`:
```yaml
qdrant:
  environment:
    - QDRANT__STORAGE__OPTIMIZERS_CONFIG__MEMMAP_THRESHOLD=20000
```

---

## 9. Performance Optimization

### 9.1 Batch Operations

Always prefer batch operations when inserting multiple vectors:

```typescript
// Good - batch insert
await qdrantService.insertVectors(points);

// Bad - individual inserts
for (const point of points) {
  await qdrantService.insertVector(point);
}
```

### 9.2 Filtered Search

Use filters to improve search performance:

```typescript
// Search only user's documents
const results = await qdrantService.searchByUser(vector, userId, 5);

// Custom filter
const results = await qdrantService.search(vector, 5, {
  must: [
    { key: 'documentId', match: { value: 'doc-123' } },
    { key: 'userId', match: { value: 'user-456' } },
  ],
});
```

### 9.3 Collection Optimization

For large collections, configure indexing:

```typescript
// Add to createCollection method
await this.client.createCollection(this.collectionName, {
  vectors: {
    size: this.vectorDimension,
    distance: 'Cosine',
  },
  optimizers_config: {
    indexing_threshold: 20000,
  },
  hnsw_config: {
    m: 16,
    ef_construct: 100,
  },
});
```

---

## 10. Next Steps

✅ **Step 5 Complete! You should now have:**
- Qdrant service integrated with NestJS
- Collection initialized automatically
- Vector CRUD operations (insert, search, delete)
- Filtered search by user/document
- Health checks and monitoring
- Test endpoints for validation

**Continue to Step 6:** Document Upload Module

---

## Quick Commands Reference

```bash
# Check Qdrant health
curl http://localhost:6333/health

# List collections
curl http://localhost:6333/collections

# Get collection info
curl http://localhost:6333/collections/documents_collection

# Access Qdrant UI
open http://localhost:6333/dashboard

# Check app health with Qdrant
curl http://localhost:3000/api/health/qdrant

# Get collection stats
curl http://localhost:3000/api/qdrant/info \
  -H "Authorization: Bearer TOKEN"

# Check Qdrant logs
docker-compose logs -f qdrant

# Restart Qdrant
docker-compose restart qdrant
```
