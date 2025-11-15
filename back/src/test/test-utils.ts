import { ObjectLiteral, Repository } from 'typeorm';

export type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
> &
  Record<string, jest.Mock>;

export const createMockRepository = <
  T extends ObjectLiteral = ObjectLiteral,
>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

export const getMockConfigService = () => ({
  get: jest.fn((key: string) => {
    const config = {
      'database.host': 'localhost',
      'database.port': 5432,
      'ollama.host': 'http://localhost:11434',
      'ollama.model': 'llama3.2',
      'qdrant.host': 'localhost',
      'qdrant.port': 6333,
      'chunking.chunkSize': 1000,
      'chunking.chunkOverlap': 200,
      'chunking.retrievalTopK': 5,
      'upload.uploadDir': './uploads',
    } as Record<string, string | number>;

    return config[key];
  }),
});
