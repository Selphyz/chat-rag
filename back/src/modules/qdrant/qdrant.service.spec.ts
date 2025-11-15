import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QdrantService } from './qdrant.service';

const mockClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  upsert: jest.fn(),
  search: jest.fn(),
  retrieve: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  getCollection: jest.fn(),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => mockClient),
}));

describe('QdrantService', () => {
  let service: QdrantService;

  const configValues = {
    'qdrant.host': 'localhost',
    'qdrant.port': 6333,
    'qdrant.collection': 'test_collection',
    'qdrant.embeddingDimension': 768,
  } as Record<string, string | number>;

  const getConfigValue = (key: string) => configValues[key];

  const mockConfigService = {
    get: jest.fn(getConfigValue),
    getOrThrow: jest.fn(getConfigValue),
  } as unknown as ConfigService;

  beforeEach(async () => {
    Object.values(mockClient).forEach((value) => {
      if (typeof value.mockReset === 'function') {
        value.mockReset();
      }
    });

    mockClient.getCollections.mockResolvedValue({ collections: [] });
    mockClient.createCollection.mockResolvedValue(undefined);
    mockClient.count.mockResolvedValue({ count: 0 });
    mockClient.getCollection.mockResolvedValue({});
    mockClient.upsert.mockResolvedValue(undefined);
    mockClient.delete.mockResolvedValue(undefined);
    mockClient.retrieve.mockResolvedValue([]);
    mockClient.search.mockResolvedValue([]);

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

  it('should detect when collection exists', async () => {
    mockClient.getCollections.mockResolvedValueOnce({
      collections: [{ name: 'test_collection' }],
    });

    await expect(service.collectionExists()).resolves.toBe(true);
  });

  it('should search using user filter in searchByUser', async () => {
    const searchSpy = jest
      .spyOn(service as any, 'search')
      .mockResolvedValue([]);

    const vector = [0.1, 0.2];
    await service.searchByUser(vector, 'user-123', 3);

    expect(searchSpy).toHaveBeenCalledWith(vector, 3, {
      must: [
        {
          key: 'userId',
          match: { value: 'user-123' },
        },
      ],
    });

    searchSpy.mockRestore();
  });
});
