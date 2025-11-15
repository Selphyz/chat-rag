import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface QdrantClientInstance {
  getCollections(): Promise<{ collections: { name: string }[] }>;
  createCollection(
    collectionName: string,
    options: Record<string, any>,
  ): Promise<void>;
  upsert(
    collectionName: string,
    payload: Record<string, any>,
  ): Promise<void>;
  search(
    collectionName: string,
    payload: Record<string, any>,
  ): Promise<Array<{ id: string | number; score: number; payload?: any }>>;
  retrieve(
    collectionName: string,
    payload: Record<string, any>,
  ): Promise<Array<Record<string, any>>>;
  delete(
    collectionName: string,
    payload: Record<string, any>,
  ): Promise<void>;
  getCollection(collectionName: string): Promise<Record<string, any>>;
  count(
    collectionName: string,
    payload: Record<string, any>,
  ): Promise<{ count: number }>;
}

interface QdrantClientConstructor {
  new (options: { url: string }): QdrantClientInstance;
}

const { QdrantClient } = require('@qdrant/js-client-rest') as {
  QdrantClient: QdrantClientConstructor;
};

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload: Record<string, any>;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClientInstance;
  private readonly collectionName: string;
  private readonly vectorDimension: number;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('qdrant.host');
    const port = this.configService.getOrThrow<number>('qdrant.port');
    this.collectionName =
      this.configService.getOrThrow<string>('qdrant.collection');
    this.vectorDimension = this.configService.getOrThrow<number>(
      'qdrant.embeddingDimension',
    );

    this.client = new QdrantClient({
      url: `http://${host}:${port}`,
    });

    this.logger.log(`Qdrant client initialized: http://${host}:${port}`);
  }

  async onModuleInit(): Promise<void> {
    await this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    try {
      const exists = await this.collectionExists();

      if (!exists) {
        this.logger.log(`Creating collection: ${this.collectionName}`);
        await this.createCollection();
        this.logger.log(
          `Collection ${this.collectionName} created successfully`,
        );
      } else {
        this.logger.log(`Collection ${this.collectionName} already exists`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize collection: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async collectionExists(): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(
        (collection) => collection.name === this.collectionName,
      );
    } catch (error) {
      this.logger.error(`Error checking collection: ${this.stringify(error)}`);
      return false;
    }
  }

  async createCollection(): Promise<void> {
    try {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorDimension,
          distance: 'Cosine',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create collection: ${this.stringify(error)}`,
      );
      throw new HttpException(
        'Failed to create vector collection',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
      this.logger.error(
        `Failed to insert vector: ${this.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Failed to insert vector',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async insertVectors(points: VectorPoint[]): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points.map((point) => ({
          id: point.id,
          vector: point.vector,
          payload: point.payload,
        })),
      });
      this.logger.debug(`Inserted ${points.length} vectors`);
    } catch (error) {
      this.logger.error(
        `Failed to insert vectors: ${this.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Failed to insert vectors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async search(
    vector: number[],
    limit = 5,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    try {
      const results = await this.client.search(this.collectionName, {
        vector,
        limit,
        filter,
        with_payload: true,
      });

      return results.map((result) => ({
        id: result.id as string,
        score: result.score,
        payload: result.payload || {},
      }));
    } catch (error) {
      this.logger.error(
        `Search failed: ${this.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Vector search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async searchByUser(
    vector: number[],
    userId: string,
    limit = 5,
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
        vector: (point.vector || []) as number[],
        payload: point.payload || {},
      };
    } catch (error) {
      this.logger.error(`Failed to get vector: ${this.stringify(error)}`);
      return null;
    }
  }

  async deleteVector(id: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [id],
      });
      this.logger.debug(`Deleted vector with ID: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete vector: ${this.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Failed to delete vector',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteVectors(ids: string[]): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: ids,
      });
      this.logger.debug(`Deleted ${ids.length} vectors`);
    } catch (error) {
      this.logger.error(
        `Failed to delete vectors: ${this.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Failed to delete vectors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter,
      });
      this.logger.debug(`Deleted vectors matching filter`);
    } catch (error) {
      this.logger.error(
        `Failed to delete by filter: ${this.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Failed to delete vectors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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

  async getCollectionInfo(): Promise<any> {
    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error) {
      this.logger.error(
        `Failed to get collection info: ${this.stringify(error)}`,
      );
      throw new HttpException(
        'Failed to get collection info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async countVectors(filter?: Record<string, any>): Promise<number> {
    try {
      const result = await this.client.count(this.collectionName, {
        filter,
        exact: false,
      });

      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to count vectors: ${this.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return Array.isArray(collections.collections);
    } catch (error) {
      this.logger.error(`Health check failed: ${this.stringify(error)}`);
      return false;
    }
  }

  getCollectionName(): string {
    return this.collectionName;
  }

  private stringify(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
