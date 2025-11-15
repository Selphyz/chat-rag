import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OllamaService } from './modules/ollama/ollama.service';
import { QdrantService } from './modules/qdrant/qdrant.service';

describe('AppController', () => {
  let appController: AppController;
  let mockDataSource: {
    isInitialized: boolean;
    options: { type: string };
    query: jest.Mock;
  };
  let mockQdrantService: {
    healthCheck: jest.Mock;
    getCollectionInfo: jest.Mock;
    countVectors: jest.Mock;
    getCollectionName: jest.Mock;
  };
  let mockOllamaService: {
    healthCheck: jest.Mock;
    listModels: jest.Mock;
    getModel: jest.Mock;
    getEmbeddingModel: jest.Mock;
  };

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      options: { type: 'postgres' },
      query: jest.fn().mockResolvedValue([1]),
    };

    mockOllamaService = {
      healthCheck: jest.fn().mockResolvedValue(true),
      listModels: jest.fn().mockResolvedValue(['llama3.2']),
      getModel: jest.fn().mockReturnValue('llama3.2'),
      getEmbeddingModel: jest.fn().mockReturnValue('nomic-embed-text'),
    };

    mockQdrantService = {
      healthCheck: jest.fn().mockResolvedValue(true),
      getCollectionInfo: jest.fn().mockResolvedValue({
        result: { vectors_count: 0 },
      }),
      countVectors: jest.fn().mockResolvedValue(0),
      getCollectionName: jest.fn().mockReturnValue('documents_collection'),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: OllamaService,
          useValue: mockOllamaService,
        },
        {
          provide: QdrantService,
          useValue: mockQdrantService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health endpoints', () => {
    it('should return aggregated health information', async () => {
      const result = await appController.healthCheck();

      expect(result.status).toBe('ok');
      expect(result.services.database.status).toBe('connected');
      expect(result.services.ollama.status).toBe('healthy');
      expect(result.services.qdrant.status).toBe('healthy');
      expect(result.services.qdrant.collection).toBe('documents_collection');
    });

    it('should confirm database connectivity', async () => {
      const result = await appController.databaseHealth();
      expect(result).toEqual({
        status: 'ok',
        database: 'connected',
      });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should report database disconnect errors', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await appController.databaseHealth();
      expect(result.status).toBe('error');
      expect(result.database).toBe('disconnected');
    });

    it('should surface Ollama health status', async () => {
      const result = await appController.ollamaHealth();
      expect(result.status).toBe('ok');
      expect(result.models).toEqual(['llama3.2']);
    });

    it('should surface Qdrant health status', async () => {
      const result = await appController.qdrantHealth();
      expect(result.status).toBe('ok');
      expect(result.collection).toBe('documents_collection');
      expect(result.vectorCount).toBe(0);
    });
  });
});
