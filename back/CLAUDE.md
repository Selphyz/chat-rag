# Claude Code Assistant Guide

**Project:** Chat RAG Backend
**Purpose:** This document helps Claude Code understand the architecture, patterns, and conventions used in this NestJS-based RAG chat application.

---

## Project Overview

This is a **Retrieval-Augmented Generation (RAG)** chat application backend that allows users to:
- Upload documents (PDF, DOCX, XLSX, TXT, MD, code files)
- Chat with an AI assistant (Llama 3.2 via Ollama)
- Ask questions about their uploaded documents
- Receive context-aware AI responses using document embeddings

**Key Concept:** When a user asks a question, the system retrieves relevant chunks from their uploaded documents and provides them as context to the LLM, resulting in accurate, document-grounded responses.

---

## Technology Stack

### Core Framework
- **NestJS v11** - TypeScript backend framework with dependency injection
- **TypeScript 5.7** - Strict mode enabled
- **Node.js 20+** - Runtime environment

### Databases
- **PostgreSQL 15** - Structured data (users, chats, messages, document metadata)
- **Qdrant v1.7** - Vector database for semantic search
- **TypeORM** - ORM for PostgreSQL with entity-based architecture

### AI/ML
- **Ollama** - Local LLM runtime (Llama 3.2 for chat, nomic-embed-text for embeddings)
- **LangChain** - Text splitting and document processing

### Authentication
- **JWT** - Stateless authentication
- **Passport.js** - Authentication middleware
- **bcrypt** - Password hashing

### Infrastructure
- **Docker Compose** - Multi-container orchestration
- **Multer** - File upload handling

---

## Architecture Patterns

### 1. Module-Based Architecture

Each feature is encapsulated in its own NestJS module:

```
src/modules/
├── auth/           # User authentication and JWT
├── chat/           # Chat sessions and messages
├── documents/      # Document upload and parsing
├── embeddings/     # Text chunking and vectorization
├── ollama/         # LLM integration wrapper
└── qdrant/         # Vector database operations
```

**Key Principle:** Modules are self-contained with their own controllers, services, entities, and DTOs. They export services that other modules can import.

### 2. Service Layer Pattern

Services contain all business logic:
- **Controllers** - Handle HTTP requests, validation, and responses
- **Services** - Implement business logic, orchestrate operations
- **Repositories** - Database access (provided by TypeORM)

**Example:**
```typescript
// Controller delegates to service
@Post('upload')
async uploadDocument(@UploadedFile() file, @CurrentUser() user) {
  return this.documentsService.uploadDocument(file, user.id);
}

// Service handles business logic
async uploadDocument(file: Express.Multer.File, userId: string) {
  // Validate, save file, create database record, trigger processing
}
```

### 3. Entity-Driven Database Design

**Core Entities:**

```
User (id, email, password)
  ├── 1:N → Chat (id, title, userId)
  │         └── 1:N → Message (id, chatId, role, content)
  └── 1:N → Document (id, userId, filename, status)
              └── 1:N → DocumentChunk (id, documentId, content, vectorId)
```

**Relationships:**
- Users own multiple chats and documents
- Chats contain multiple messages (user and assistant)
- Documents are split into chunks, each with a corresponding vector in Qdrant

### 4. RAG Pipeline Architecture

**Flow:**
1. **Document Upload** → Parse → Chunk → Embed → Store in Qdrant
2. **User Question** → Embed query → Search Qdrant → Retrieve top K chunks
3. **AI Response** → Build prompt with context → Send to Ollama → Return response

**Key Services:**
- `DocumentsService` - File handling and metadata
- `EmbeddingsService` - Orchestrates chunking and vector storage
- `ChatService` - Implements RAG pipeline during message handling
- `OllamaService` - LLM and embedding API wrapper
- `QdrantService` - Vector CRUD operations

---

## Configuration Management

### Environment-Based Config

**Location:** `src/config/configuration.ts`

All configuration is centralized and typed:

```typescript
export default () => ({
  database: { host, port, name, user, password },
  jwt: { secret, expiresIn },
  ollama: { host, model, embeddingModel },
  qdrant: { host, port, collection, embeddingDimension },
  upload: { maxFileSize, uploadDir },
  chunking: { chunkSize, chunkOverlap, retrievalTopK },
});
```

**Usage in Services:**
```typescript
constructor(private configService: ConfigService) {
  this.model = configService.get<string>('ollama.model');
}
```

**Important:** Always use `ConfigService` instead of `process.env` directly for type safety and testability.

---

## Database Conventions

### Entity Design

1. **Use UUIDs for primary keys:**
   ```typescript
   @PrimaryGeneratedColumn('uuid')
   id: string;
   ```

2. **Timestamp tracking:**
   ```typescript
   @CreateDateColumn({ name: 'created_at' })
   createdAt: Date;

   @UpdateDateColumn({ name: 'updated_at' })
   updatedAt: Date;
   ```

3. **Foreign keys with cascade:**
   ```typescript
   @ManyToOne(() => User, { onDelete: 'CASCADE' })
   @JoinColumn({ name: 'user_id' })
   user: User;
   ```

4. **Enums for status fields:**
   ```typescript
   export enum DocumentStatus {
     PROCESSING = 'processing',
     PROCESSED = 'processed',
     FAILED = 'failed',
   }
   ```

### Migration Strategy

- **Development:** `synchronize: true` (auto-sync schema)
- **Production:** `synchronize: false` (use migrations only)

**Generate migration:**
```bash
npm run migration:generate -- src/database/migrations/MigrationName
```

---

## Authentication Flow

### JWT Strategy

1. **Registration/Login** → Hash password → Generate JWT token
2. **Protected Routes** → Validate JWT → Inject user into request
3. **Public Routes** → Use `@Public()` decorator to bypass auth

**Key Files:**
- `auth.service.ts` - Registration, login, token generation
- `jwt.strategy.ts` - Token validation
- `jwt-auth.guard.ts` - Global guard (applied to all routes by default)
- `current-user.decorator.ts` - Extract user from request

**Usage:**
```typescript
@Get('profile')
async getProfile(@CurrentUser() user: User) {
  return user;  // User is automatically injected and validated
}

@Public()
@Post('login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

---

## Vector Search & RAG Implementation

### Document Processing Pipeline

```typescript
// 1. Upload document
uploadDocument(file, userId)
  → Save file to disk
  → Create Document entity (status: PROCESSING)

// 2. Process document (async)
processDocument(documentId)
  → Parse file to text
  → Split text into chunks (LangChain RecursiveCharacterTextSplitter)
  → Generate embeddings (Ollama nomic-embed-text)
  → Store chunks in PostgreSQL
  → Store vectors in Qdrant with payload
  → Update Document status to PROCESSED
```

### Vector Payload Structure

Each vector in Qdrant includes:
```typescript
{
  id: "documentId-chunk-0",
  vector: [0.123, 0.456, ...],  // 768-dimensional embedding
  payload: {
    chunkId: "uuid",
    documentId: "uuid",
    userId: "uuid",
    content: "actual text content...",
    metadata: {
      filename: "document.pdf",
      chunkIndex: 0
    }
  }
}
```

### RAG Retrieval

```typescript
// Chat service implementation
async sendMessage(chatId, userId, content) {
  // 1. Retrieve context
  const context = await embeddingsService.searchRelevantChunks(
    content,    // User's question
    userId,     // Filter to user's documents only
    5           // Top K results
  );

  // 2. Build prompt with context
  const systemPrompt = buildSystemPrompt(context);

  // 3. Get chat history for continuity
  const history = await getChatHistory(chatId);

  // 4. Generate AI response
  const response = await ollamaService.chat([
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: content }
  ]);

  // 5. Save both messages
  await saveMessage(chatId, 'user', content);
  await saveMessage(chatId, 'assistant', response);
}
```

**Key Insight:** The system prompt includes retrieved document chunks as context, making the AI's response grounded in the user's actual documents.

---

## File Upload & Parsing

### Supported File Types

| Type | Extensions | Parser |
|------|-----------|--------|
| PDF | .pdf | pdf-parse |
| Word | .docx | mammoth |
| Excel | .xlsx | xlsx |
| Text | .txt, .md | UTF-8 reader |
| Code | .js, .ts, .py, etc. | UTF-8 reader |

### Parser Pattern

Each parser implements:
```typescript
@Injectable()
export class PdfParser {
  async parse(buffer: Buffer): Promise<string> {
    // Extract text from PDF
    const data = await pdfParse(buffer);
    return data.text;
  }
}
```

**Service Orchestration:**
```typescript
async parseDocument(documentId: string): Promise<string> {
  const document = await this.findById(documentId);
  const buffer = await fs.readFile(filepath);

  // Route to appropriate parser based on MIME type
  if (document.mimeType.includes('pdf')) {
    return await this.pdfParser.parse(buffer);
  } else if (document.mimeType.includes('wordprocessingml')) {
    return await this.docxParser.parse(buffer);
  }
  // ... etc
}
```

---

## Error Handling

### Exception Filters

**Global filter:** `src/common/filters/http-exception.filter.ts`

Returns consistent error responses:
```json
{
  "statusCode": 400,
  "timestamp": "2025-11-14T10:00:00.000Z",
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Service Error Patterns

```typescript
// Not Found
throw new NotFoundException('Document not found');

// Validation Error
throw new BadRequestException('Invalid file type');

// Unauthorized
throw new UnauthorizedException('Invalid credentials');

// Service Unavailable (external services)
throw new HttpException(
  'Ollama service unavailable',
  HttpStatus.SERVICE_UNAVAILABLE
);
```

---

## Testing Approach

### Unit Tests

Test services in isolation with mocked dependencies:

```typescript
const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [
    ChatService,
    { provide: getRepositoryToken(Chat), useValue: mockRepository },
  ],
}).compile();
```

### E2E Tests

Test complete flows with real HTTP requests:

```typescript
it('should create chat and send message', async () => {
  // Register user
  const { access_token } = await request(app)
    .post('/api/auth/register')
    .send({ email: 'test@example.com', password: 'password123' });

  // Create chat
  const { id: chatId } = await request(app)
    .post('/api/chats')
    .set('Authorization', `Bearer ${access_token}`)
    .send({ title: 'Test Chat' });

  // Send message
  await request(app)
    .post(`/api/chats/${chatId}/messages`)
    .set('Authorization', `Bearer ${access_token}`)
    .send({ message: 'Hello!' });
});
```

---

## Common Development Tasks

### Adding a New Endpoint

1. Create DTO in `dto/` folder with validation decorators
2. Add method to service with business logic
3. Add controller method with route decorators
4. Update module imports if needed

### Adding a New Entity

1. Create entity in `entities/` folder
2. Add to module's `TypeOrmModule.forFeature([NewEntity])`
3. Generate migration: `npm run migration:generate`
4. Run migration: `npm run migration:run`

### Adding External Service Integration

1. Create module in `src/modules/service-name/`
2. Create service with `@Injectable()` decorator
3. Initialize client in constructor using ConfigService
4. Export service from module
5. Import module where needed

### Debugging

- **Logs:** Use NestJS Logger in services
- **Database queries:** Set `logging: true` in TypeORM config
- **Health checks:** `/api/health`, `/api/health/db`, `/api/health/ollama`, `/api/health/qdrant`

---

## Security Considerations

### Current Implementation

1. **Password Security:** bcrypt with 10 salt rounds
2. **JWT Tokens:** Signed, 7-day expiration
3. **File Upload:** Size limits (10MB), type validation
4. **Authorization:** Row-level checks (users can only access their own data)
5. **CORS:** Enabled for specific frontend origin

### Data Isolation

**Critical:** All queries must filter by userId:

```typescript
// GOOD
await this.documentRepository.find({ where: { userId } });

// BAD - Exposes all users' data
await this.documentRepository.find();
```

**Ownership Checks:**
```typescript
const document = await this.documentsService.findById(id);
if (document.userId !== user.id) {
  throw new BadRequestException('Access denied');
}
```

---

## Docker & Deployment

### Service Dependencies

```
app → depends on → postgres, qdrant, ollama
```

**Health Checks:** All services have health checks defined in docker-compose.yml. The app waits for dependencies to be healthy before starting.

### Volumes

- `postgres_data` - Database persistence
- `qdrant_data` - Vector storage persistence
- `ollama_data` - Downloaded models persistence
- `./uploads` - Uploaded documents (bind mount)

### Environment Variables

**Development:** Use `.env` file (not committed to git)
**Production:** Use Docker secrets or environment variable injection

---

## Code Style & Conventions

### Naming Conventions

- **Files:** `kebab-case.ts` (e.g., `chat.service.ts`)
- **Classes:** `PascalCase` (e.g., `ChatService`)
- **Methods:** `camelCase` (e.g., `sendMessage()`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)
- **Interfaces:** `PascalCase` with descriptive names (e.g., `ChatMessage`)

### TypeScript Guidelines

- **Strict mode enabled** - No implicit any
- **Explicit return types** on public methods
- **Interfaces over types** for data structures
- **Enums for fixed sets** of values

### NestJS Patterns

```typescript
// Dependency Injection
constructor(
  private readonly chatService: ChatService,
  private configService: ConfigService,
) {}

// DTOs with validation
export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}

// Route decorators
@Controller('chats')
export class ChatController {
  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ) {
    // Implementation
  }
}
```

---

## Performance Considerations

### Database Queries

- **Use eager loading sparingly:** Only load relations when needed
- **Implement pagination:** For list endpoints
- **Add indexes:** On frequently queried columns (userId, chatId, etc.)

### Vector Search

- **Limit results:** Default to top 5 chunks
- **Use filters:** Always filter by userId for scoped search
- **Batch operations:** Use `insertVectors()` not `insertVector()` in loops

### LLM Calls

- **Streaming:** Implement for better UX (optional)
- **Token limits:** Set `maxTokens` to prevent excessive generation
- **Context window:** Limit chat history to last 10 messages

---

## Troubleshooting Guide

### Common Issues

**1. "JWT_SECRET not defined"**
- Check `.env` file exists and has JWT_SECRET
- Ensure ConfigModule is loaded globally

**2. "Connection to PostgreSQL failed"**
- Check docker-compose services are running
- Verify DATABASE_HOST is correct (use service name in Docker)

**3. "Qdrant collection not found"**
- Service auto-creates collection on startup
- Check Qdrant logs: `docker-compose logs qdrant`

**4. "Ollama models not found"**
- Pull models: `docker exec -it chatrag-ollama ollama pull llama3.2`
- Pull embedding model: `docker exec -it chatrag-ollama ollama pull nomic-embed-text`

**5. "Vector dimension mismatch"**
- Verify `EMBEDDING_DIMENSION` matches the actual model output
- nomic-embed-text produces 768-dimensional vectors

---

## Development Workflow

### Starting the Application

```bash
# 1. Start Docker services
docker-compose up -d postgres qdrant ollama

# 2. Pull Ollama models (first time only)
docker exec -it chatrag-ollama ollama pull llama3.2
docker exec -it chatrag-ollama ollama pull nomic-embed-text

# 3. Install dependencies
npm install

# 4. Run migrations
npm run migration:run

# 5. Start app in dev mode
npm run start:dev
```

### Database Changes

1. **Modify entity** or create new one
2. **Generate migration:** `npm run migration:generate -- src/database/migrations/FeatureName`
3. **Review generated migration** to ensure correctness
4. **Run migration:** `npm run migration:run`
5. **Test rollback:** `npm run migration:revert` (then re-run)

---

## API Documentation

**Swagger UI:** `http://localhost:3000/api/docs`

All endpoints are documented with:
- Request/response schemas
- Authentication requirements
- Example payloads
- Error responses

**Decorators:**
```typescript
@ApiTags('chats')
@ApiBearerAuth()
@ApiOperation({ summary: 'Send message to chat' })
@ApiResponse({ status: 201, description: 'Message sent successfully' })
```

---

## Future Enhancements (Post-MVP)

Potential features to add:

1. **Streaming responses** - SSE for real-time AI responses
2. **Multi-model support** - Allow users to select different LLMs
3. **Document preview** - Show which chunks were used for answer
4. **Conversation memory** - Summarization for very long chats
5. **Rate limiting** - Prevent abuse
6. **Caching** - Cache frequent embeddings/responses
7. **Background jobs** - Bull queue for document processing
8. **Webhooks** - Notify when document processing completes

---

## Resources

- **NestJS Docs:** https://docs.nestjs.com/
- **TypeORM Docs:** https://typeorm.io/
- **Qdrant Docs:** https://qdrant.tech/documentation/
- **Ollama API:** https://github.com/ollama/ollama/blob/main/docs/api.md
- **LangChain JS:** https://js.langchain.com/

---

## Questions to Ask When Working on This Codebase

1. **Does this endpoint need authentication?** (Default: yes, use `@Public()` to opt-out)
2. **Does this query filter by userId?** (Security critical!)
3. **Should this be async?** (Most service methods should be)
4. **Is this testable?** (Can I mock dependencies?)
5. **What happens if this external service fails?** (Error handling)
6. **Is this configuration from ConfigService?** (Don't use process.env directly)
7. **Does this need validation?** (Use DTOs with decorators)

---

**Remember:** This is a RAG application. The core value is in the pipeline that turns documents into searchable vectors and uses them to enhance AI responses. Every feature should serve this goal.
