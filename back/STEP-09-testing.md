# Step 9: Testing & Documentation

**Estimated Time:** 3-4 hours
**Prerequisites:** Steps 1-8 completed

---

## Overview

In this final step, we'll add comprehensive testing and documentation:
- Unit tests for services
- E2E tests for API endpoints
- API documentation with Swagger
- README with setup instructions
- Deployment guide

---

## 1. Swagger/OpenAPI Documentation

### 1.1 Install Swagger

```bash
npm install @nestjs/swagger
```

### 1.2 Configure Swagger in `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Chat RAG API')
    .setDescription('API for RAG-based chat application with document upload')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('chats', 'Chat management')
    .addTag('documents', 'Document upload and management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
  console.log(`📚 API Documentation: ${await app.getUrl()}/api/docs`);
}
bootstrap();
```

### 1.3 Add Swagger Decorators to Controllers

Update `src/modules/auth/auth.controller.ts`:

```typescript
import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
```

Apply similar decorators to other controllers (ChatController, DocumentsController).

---

## 2. Unit Tests

### 2.1 Test Configuration Helper - `src/test/test-utils.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export const createMockRepository = <T = any>(): Partial<Repository<T>> => ({
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
      'chunking.retrievalTopK': 5,
    };
    return config[key];
  }),
});
```

### 2.2 Chat Service Tests

Create `src/modules/chat/chat.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { OllamaService } from '../ollama/ollama.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { ConfigService } from '@nestjs/config';
import { createMockRepository, getMockConfigService } from '../../test/test-utils';

describe('ChatService', () => {
  let service: ChatService;
  let chatRepository;
  let messageRepository;

  beforeEach(async () => {
    chatRepository = createMockRepository();
    messageRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(Chat),
          useValue: chatRepository,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: messageRepository,
        },
        {
          provide: OllamaService,
          useValue: {
            chat: jest.fn().mockResolvedValue('AI response'),
          },
        },
        {
          provide: EmbeddingsService,
          useValue: {
            searchRelevantChunks: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ConfigService,
          useValue: getMockConfigService(),
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createChat', () => {
    it('should create a new chat', async () => {
      const userId = 'user-123';
      const title = 'Test Chat';

      chatRepository.create.mockReturnValue({ id: 'chat-123', userId, title });
      chatRepository.save.mockResolvedValue({ id: 'chat-123', userId, title });

      const result = await service.createChat(userId, title);

      expect(result.id).toBe('chat-123');
      expect(result.userId).toBe(userId);
      expect(chatRepository.create).toHaveBeenCalledWith({ userId, title });
    });
  });

  describe('getUserChats', () => {
    it('should return all user chats', async () => {
      const userId = 'user-123';
      const mockChats = [
        { id: 'chat-1', userId, title: 'Chat 1' },
        { id: 'chat-2', userId, title: 'Chat 2' },
      ];

      chatRepository.find.mockResolvedValue(mockChats);

      const result = await service.getUserChats(userId);

      expect(result).toEqual(mockChats);
      expect(chatRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { updatedAt: 'DESC' },
      });
    });
  });
});
```

Run tests:
```bash
npm test chat.service.spec.ts
```

---

## 3. E2E Tests

### 3.1 E2E Test Setup

Create `test/app.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let chatId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('api');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/api (GET)', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect('Hello World!');
    });

    it('/api/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('services');
        });
    });
  });

  describe('Authentication Flow', () => {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
    };

    it('/api/auth/register (POST)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body.user).toHaveProperty('email', testUser.email);
          authToken = res.body.access_token;
        });
    });

    it('/api/auth/login (POST)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send(testUser)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
        });
    });

    it('/api/auth/profile (GET) - should require auth', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .expect(401);
    });

    it('/api/auth/profile (GET) - with token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', testUser.email);
        });
    });
  });

  describe('Chat Flow', () => {
    it('/api/chats (POST) - create chat', () => {
      return request(app.getHttpServer())
        .post('/api/chats')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test Chat' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Test Chat');
          chatId = res.body.id;
        });
    });

    it('/api/chats (GET) - list chats', () => {
      return request(app.getHttpServer())
        .get('/api/chats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });

    it('/api/chats/:id/messages (POST) - send message', () => {
      return request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Hello, AI!' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('userMessage');
          expect(res.body).toHaveProperty('assistantMessage');
        });
    });

    it('/api/chats/:id (GET) - get chat with messages', () => {
      return request(app.getHttpServer())
        .get(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('messages');
          expect(res.body.messages.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('/api/chats/:id (DELETE) - delete chat', () => {
      return request(app.getHttpServer())
        .delete(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});
```

Run E2E tests:
```bash
npm run test:e2e
```

---

## 4. Update README

Create/Update `README.md`:

```markdown
# Chat RAG Backend

A RAG (Retrieval-Augmented Generation) chat application backend built with NestJS, Ollama (Llama 3.2), and Qdrant.

## Features

- 🔐 **JWT Authentication** - Secure user registration and login
- 💬 **Chat Management** - Create and manage multiple chat sessions
- 📄 **Document Upload** - Support for PDF, DOCX, XLSX, TXT, MD, and code files
- 🔍 **Vector Search** - Qdrant-powered semantic search
- 🤖 **AI Responses** - Llama 3.2 via Ollama
- 📚 **RAG Pipeline** - Context-aware responses from uploaded documents
- 🐳 **Docker Compose** - Easy deployment with all services

## Tech Stack

- **Framework**: NestJS v11
- **Database**: PostgreSQL 15
- **Vector DB**: Qdrant v1.7
- **LLM**: Ollama (Llama 3.2)
- **ORM**: TypeORM
- **Authentication**: JWT with Passport
- **Document Processing**: LangChain, pdf-parse, mammoth, xlsx

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- At least 8GB RAM (for Ollama)

## Quick Start

### 1. Clone and Setup

\`\`\`bash
git clone <repository-url>
cd back
cp .env.example .env
\`\`\`

### 2. Generate JWT Secret

\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

Update `.env` with the generated secret.

### 3. Start Services

\`\`\`bash
docker-compose up -d
\`\`\`

### 4. Pull Ollama Models

\`\`\`bash
docker exec -it chatrag-ollama ollama pull llama3.2
docker exec -it chatrag-ollama ollama pull nomic-embed-text
\`\`\`

### 5. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 6. Run Migrations

\`\`\`bash
npm run migration:run
\`\`\`

### 7. Start Application

\`\`\`bash
npm run start:dev
\`\`\`

The API will be available at: `http://localhost:3000/api`

API Documentation: `http://localhost:3000/api/docs`

## Environment Variables

See `.env.example` for all available configuration options.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user

### Chats
- `POST /api/chats` - Create chat
- `GET /api/chats` - List chats
- `GET /api/chats/:id` - Get chat with messages
- `DELETE /api/chats/:id` - Delete chat
- `POST /api/chats/:id/messages` - Send message

### Documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document details
- `DELETE /api/documents/:id` - Delete document

### Health
- `GET /api/health` - Overall health status
- `GET /api/health/db` - Database health
- `GET /api/health/ollama` - Ollama health
- `GET /api/health/qdrant` - Qdrant health

## Testing

\`\`\`bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
\`\`\`

## Project Structure

\`\`\`
src/
├── common/                 # Shared utilities
├── config/                 # Configuration
├── modules/
│   ├── auth/              # Authentication
│   ├── chat/              # Chat management
│   ├── documents/         # Document upload
│   ├── embeddings/        # Vectorization
│   ├── ollama/            # LLM integration
│   └── qdrant/            # Vector DB
├── app.module.ts
└── main.ts
\`\`\`

## Development

\`\`\`bash
# Development mode with hot reload
npm run start:dev

# Build for production
npm run build

# Production mode
npm run start:prod
\`\`\`

## Docker Commands

\`\`\`bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f app

# Rebuild and restart
docker-compose up -d --build
\`\`\`

## Troubleshooting

### Ollama Models Not Found

\`\`\`bash
docker exec -it chatrag-ollama ollama list
docker exec -it chatrag-ollama ollama pull llama3.2
docker exec -it chatrag-ollama ollama pull nomic-embed-text
\`\`\`

### Database Connection Issues

\`\`\`bash
docker-compose ps postgres
docker-compose logs postgres
\`\`\`

### Reset Everything

\`\`\`bash
docker-compose down -v  # WARNING: Deletes all data!
docker-compose up -d
\`\`\`

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
\`\`\`

---

## 5. Test Coverage

### 5.1 Generate Coverage Report

```bash
npm run test:cov
```

View coverage:
```bash
open coverage/lcov-report/index.html
```

### 5.2 Coverage Goals

Aim for:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

---

## 6. Performance Testing (Optional)

### 6.1 Install Artillery

```bash
npm install -D artillery
```

### 6.2 Create Load Test - `test/load-test.yml`

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "Chat Flow"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
          capture:
            - json: "$.access_token"
              as: "token"
      - post:
          url: "/api/chats"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            title: "Load Test Chat"
          capture:
            - json: "$.id"
              as: "chatId"
      - post:
          url: "/api/chats/{{ chatId }}/messages"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            message: "Hello, AI!"
```

Run load test:
```bash
npx artillery run test/load-test.yml
```

---

## 7. Deployment

### 7.1 Production Checklist

- [ ] Set strong JWT_SECRET
- [ ] Use environment-specific .env files
- [ ] Set synchronize: false (use migrations)
- [ ] Enable HTTPS
- [ ] Set up rate limiting
- [ ] Configure logging (Winston, Sentry)
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure backups for PostgreSQL and Qdrant
- [ ] Use Docker secrets for sensitive data
- [ ] Set resource limits in docker-compose.yml
- [ ] Enable CORS for specific domains only

### 7.2 Production docker-compose.yml

See deployment guide in repository for production configuration.

---

## 8. Next Steps

✅ **Step 9 Complete! Your application now has:**
- Comprehensive API documentation with Swagger
- Unit tests for services
- E2E tests for endpoints
- Complete README
- Performance testing setup
- Deployment checklist

## 🎉 Congratulations!

You have successfully built a complete RAG-based chat application with:
- ✅ Multi-user authentication
- ✅ Document upload and processing
- ✅ Vector-based semantic search
- ✅ Context-aware AI responses
- ✅ Complete API documentation
- ✅ Comprehensive testing

---

## Quick Commands Reference

```bash
# View API docs
open http://localhost:3000/api/docs

# Run all tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov

# Load test
npx artillery run test/load-test.yml

# Production build
npm run build
npm run start:prod
```

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Ollama Documentation](https://ollama.ai/docs)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [LangChain Documentation](https://js.langchain.com/)
