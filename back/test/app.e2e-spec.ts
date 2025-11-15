import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { Duplex } from 'stream';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { User } from '../src/modules/auth/entities/user.entity';
import { OllamaService } from '../src/modules/ollama/ollama.service';
import { QdrantService } from '../src/modules/qdrant/qdrant.service';

class InMemoryUserRepository {
  private users: User[] = [];

  async findOne(options: { where: Partial<User> }): Promise<User | null> {
    const where = options?.where ?? {};
    const predicates = Object.entries(where);

    return (
      this.users.find((user) =>
        predicates.every(
          ([key, value]) => user[key as keyof User] === value,
        ),
      ) || null
    );
  }

  create(data: Partial<User>): User {
    const now = new Date();
    return {
      id: data.id ?? randomUUID(),
      email: data.email ?? '',
      password: data.password ?? '',
      chats: [],
      documents: [],
      createdAt: now,
      updatedAt: now,
    } as User;
  }

  async save(user: User): Promise<User> {
    const index = this.users.findIndex(
      (existing) => existing.id === user.id,
    );
    const entity: User = {
      ...user,
      createdAt:
        user.createdAt ??
        (index >= 0 ? this.users[index].createdAt : new Date()),
      updatedAt: new Date(),
    };

    if (index >= 0) {
      this.users[index] = entity;
    } else {
      this.users.push(entity);
    }

    return entity;
  }

  clear() {
    this.users = [];
  }
}

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1';

  _read(): void {}

  _write(
    _chunk: any,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    callback();
  }
}

interface HttpResponse<T = any> {
  status: number;
  body: T;
  headers: Record<string, any>;
}

describe('Application (e2e)', () => {
  let app: INestApplication;
  let httpHandler: any;
  const userRepository = new InMemoryUserRepository();

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'jwt.secret') {
        return 'test-secret';
      }
      if (key === 'jwt.expiresIn') {
        return '1h';
      }
      return undefined;
    }),
  };

  const mockDataSource = {
    isInitialized: true,
    options: { type: 'postgres' },
    query: jest.fn().mockResolvedValue([1]),
  };

  const mockOllamaService = {
    healthCheck: jest.fn().mockResolvedValue(true),
    listModels: jest.fn().mockResolvedValue(['llama3.2']),
    getModel: jest.fn().mockReturnValue('llama3.2'),
    getEmbeddingModel: jest.fn().mockReturnValue('nomic-embed-text'),
  };

  const mockQdrantService = {
    healthCheck: jest.fn().mockResolvedValue(true),
    getCollectionName: jest.fn().mockReturnValue('documents_collection'),
    getCollectionInfo: jest
      .fn()
      .mockResolvedValue({ status: 'green', vectors_count: 0 }),
    countVectors: jest.fn().mockResolvedValue(0),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AppController, AuthController],
      providers: [
        AppService,
        AuthService,
        JwtStrategy,
        Reflector,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: OllamaService, useValue: mockOllamaService },
        { provide: QdrantService, useValue: mockQdrantService },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();
    httpHandler = app.getHttpAdapter().getInstance();
  });

  beforeEach(() => {
    userRepository.clear();
    mockDataSource.query.mockClear();
    mockOllamaService.healthCheck.mockClear();
    mockOllamaService.listModels.mockClear();
    mockQdrantService.healthCheck.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  const sendHttpRequest = async <T = any>(
    method: string,
    url: string,
    options?: { body?: any; headers?: Record<string, string> },
  ): Promise<HttpResponse<T>> => {
    if (!httpHandler) {
      throw new Error('Application not initialized');
    }

    return new Promise((resolve, reject) => {
      const socket = new MockSocket();
      const req = new IncomingMessage(socket as any);
      const headers = Object.fromEntries(
        Object.entries(options?.headers ?? {}).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      );

      req.url = url;
      req.method = method;
      req.headers = {
        host: 'localhost',
        ...headers,
      };

      if (options?.body !== undefined) {
        const payload =
          typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body);
        if (!req.headers['content-type']) {
          req.headers['content-type'] = 'application/json';
        }
        req.headers['content-length'] = Buffer.byteLength(
          payload,
        ).toString();
        req.push(payload);
      }

      req.push(null);

      const res = new ServerResponse(req);
      const chunks: Buffer[] = [];

      res.write = ((
        chunk: any,
        encoding?: BufferEncoding | (() => void),
        callback?: () => void,
      ) => {
        if (chunk) {
          const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(
                chunk,
                typeof encoding === 'string' ? encoding : undefined,
              );
          chunks.push(buffer);
        }

        if (typeof encoding === 'function') {
          encoding();
        } else if (typeof callback === 'function') {
          callback();
        }

        return true;
      }) as typeof res.write;

      res.end = ((
        chunk?: any,
        encoding?: BufferEncoding | (() => void),
        callback?: () => void,
      ) => {
        if (chunk) {
          const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(
                chunk,
                typeof encoding === 'string' ? encoding : undefined,
              );
          chunks.push(buffer);
        }

        if (typeof encoding === 'function') {
          encoding();
        } else if (typeof callback === 'function') {
          callback();
        }

        const raw = Buffer.concat(chunks).toString();
        const contentType = res.getHeader('content-type');
        let parsed: any = raw;

        if (
          contentType &&
          contentType.toString().includes('application/json')
        ) {
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = raw;
          }
        }

        resolve({
          status: res.statusCode,
          body: parsed,
          headers: res.getHeaders(),
        });

        return res;
      }) as typeof res.end;

      res.on('error', reject);

      httpHandler(req, res);
    });
  };

  const registerUser = async (overrides?: {
    email?: string;
    password?: string;
  }) => {
    const credentials = {
      email: overrides?.email || `test-${Date.now()}@example.com`,
      password: overrides?.password || 'password123',
    };

    const response = await sendHttpRequest<{
      access_token: string;
      user: { email: string };
    }>('POST', '/api/auth/register', {
      body: credentials,
    });

    expect(response.status).toBe(201);
    return { credentials, body: response.body };
  };

  describe('Health checks', () => {
    it('GET /api should return hello world', async () => {
      const response = await sendHttpRequest('GET', '/api');
      expect(response.status).toBe(200);
      expect(response.body).toBe('Hello World!');
    });

    it('GET /api/health should include service statuses', async () => {
      const response = await sendHttpRequest('GET', '/api/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.services.database.status).toBe('connected');
      expect(response.body.services.ollama.status).toBe('healthy');
      expect(response.body.services.qdrant.collection).toBe(
        'documents_collection',
      );
    });
  });

  describe('Authentication flow', () => {
    it('registers a user and returns a JWT', async () => {
      const { credentials, body } = await registerUser();

      expect(body).toHaveProperty('access_token');
      expect(body.user.email).toBe(credentials.email);
    });

    it('allows a registered user to login', async () => {
      const { credentials } = await registerUser();

      const response = await sendHttpRequest<{
        access_token: string;
        user: { email: string };
      }>('POST', '/api/auth/login', {
        body: credentials,
      });

      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.user.email).toBe(credentials.email);
    });

    it('requires authentication for profile endpoint', async () => {
      await registerUser();

      const response = await sendHttpRequest('GET', '/api/auth/profile');
      expect(response.status).toBe(401);
    });

    it('returns profile when valid token is provided', async () => {
      const { credentials, body } = await registerUser();
      const token = body.access_token;

      const response = await sendHttpRequest('GET', '/api/auth/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(credentials.email);
    });

    it('rejects login attempts from unknown users', async () => {
      const response = await sendHttpRequest(
        'POST',
        '/api/auth/login',
        {
          body: {
            email: 'missing@example.com',
            password: 'does-not-matter',
          },
        },
      );

      expect(response.status).toBe(401);
    });

    it('rejects malformed payloads', async () => {
      const response = await sendHttpRequest(
        'POST',
        '/api/auth/register',
        {
          body: { email: 'invalid-email' },
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBeDefined();
    });
  });
});
