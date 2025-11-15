import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';

const mockChat = jest.fn();
const mockEmbeddings = jest.fn();
const mockList = jest.fn();
const mockPull = jest.fn();

jest.mock('ollama', () => {
  return {
    Ollama: jest.fn().mockImplementation(() => ({
      chat: mockChat,
      embeddings: mockEmbeddings,
      list: mockList,
      pull: mockPull,
    })),
  };
});

describe('OllamaService', () => {
  let service: OllamaService;

  const configValues = {
    'ollama.host': 'http://localhost:11434',
    'ollama.model': 'llama3.2',
    'ollama.embeddingModel': 'nomic-embed-text',
  };

  const getConfigValue = (key: string) => configValues[key];

  const mockConfigService = {
    get: jest.fn(getConfigValue),
    getOrThrow: jest.fn(getConfigValue),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockChat.mockResolvedValue({
      message: { content: 'mock-response' },
    });
    mockEmbeddings.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
    });
    mockList.mockResolvedValue({
      models: [
        { name: 'llama3.2' },
        { name: 'nomic-embed-text' },
      ],
    });
    mockPull.mockResolvedValue(undefined);

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

  it('should return chat model name', () => {
    expect(service.getModel()).toBe('llama3.2');
  });

  it('should return embedding model name', () => {
    expect(service.getEmbeddingModel()).toBe('nomic-embed-text');
  });

  it('should call Ollama chat API', async () => {
    const response = await service.chat([
      { role: 'system', content: 'You are a test' },
      { role: 'user', content: 'Hi' },
    ]);

    expect(response).toBe('mock-response');
    expect(mockChat).toHaveBeenCalled();
  });

  it('should generate embeddings', async () => {
    const embedding = await service.generateEmbedding('test text');

    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbeddings).toHaveBeenCalledWith({
      model: 'nomic-embed-text',
      prompt: 'test text',
    });
  });

  it('should check health successfully when models exist', async () => {
    const result = await service.healthCheck();
    expect(result).toBe(true);
    expect(mockList).toHaveBeenCalled();
  });

  it('should list models', async () => {
    const models = await service.listModels();
    expect(models).toEqual(['llama3.2', 'nomic-embed-text']);
  });
});
