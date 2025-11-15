import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';
import { OllamaService } from './modules/ollama/ollama.service';
import { QdrantService } from './modules/qdrant/qdrant.service';

@Controller()
@ApiTags('Health')
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private dataSource: DataSource,
    private readonly ollamaService: OllamaService,
    private readonly qdrantService: QdrantService,
  ) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Get general health status',
    description:
      'Returns the overall health status of the application including database and Ollama connectivity',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      example: {
        status: 'degraded',
        timestamp: '2025-11-14T23:30:00.000Z',
        uptime: 125.5,
        services: {
          database: {
            status: 'connected',
            type: 'postgres',
          },
          ollama: {
            status: 'unhealthy',
            model: 'llama3.2',
            embeddingModel: 'nomic-embed-text',
          },
          qdrant: {
            status: 'healthy',
            collection: 'documents_collection',
          },
        },
      },
    },
  })
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
        database: {
          status: isDbConnected ? 'connected' : 'disconnected',
          type: this.dataSource.options.type,
        },
        ollama: {
          status: isOllamaHealthy ? 'healthy' : 'unhealthy',
          model: this.ollamaService.getModel(),
          embeddingModel: this.ollamaService.getEmbeddingModel(),
        },
        qdrant: {
          status: isQdrantHealthy ? 'healthy' : 'unhealthy',
          collection: this.qdrantService.getCollectionName(),
        },
      },
    };
  }

  @Public()
  @Get('health/db')
  @ApiOperation({
    summary: 'Check database connectivity',
    description: 'Performs a test query to verify database connection is working',
  })
  @ApiResponse({
    status: 200,
    description: 'Database is connected',
    schema: {
      example: {
        status: 'ok',
        database: 'connected',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Database connection failed',
    schema: {
      example: {
        status: 'error',
        database: 'disconnected',
        error: 'Connection timeout',
      },
    },
  })
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
  @ApiOperation({
    summary: 'Check Ollama connectivity and available models',
    description:
      'Returns status information from the Ollama runtime including which models are available',
  })
  @ApiResponse({
    status: 200,
    description: 'Ollama status retrieved',
    schema: {
      example: {
        status: 'ok',
        models: ['llama3.2', 'nomic-embed-text'],
        currentModel: 'llama3.2',
        embeddingModel: 'nomic-embed-text',
      },
    },
  })
  async ollamaHealth() {
    try {
      const isHealthy = await this.ollamaService.healthCheck();
      const models = await this.ollamaService.listModels();

      return {
        status: isHealthy ? 'ok' : 'error',
        models,
        currentModel: this.ollamaService.getModel(),
        embeddingModel: this.ollamaService.getEmbeddingModel(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Public()
  @Get('health/qdrant')
  @ApiOperation({
    summary: 'Check Qdrant connectivity and collection details',
    description:
      'Returns Qdrant health status, collection information, and current vector count',
  })
  @ApiResponse({
    status: 200,
    description: 'Qdrant status retrieved',
    schema: {
      example: {
        status: 'ok',
        collection: 'documents_collection',
        vectorCount: 10,
        collectionInfo: {
          status: 'green',
          vectors_count: 10,
        },
      },
    },
  })
  async qdrantHealth() {
    try {
      const isHealthy = await this.qdrantService.healthCheck();
      const collectionInfo = await this.qdrantService.getCollectionInfo();
      const vectorCount = await this.qdrantService.countVectors();

      return {
        status: isHealthy ? 'ok' : 'error',
        collection: this.qdrantService.getCollectionName(),
        vectorCount,
        collectionInfo,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
