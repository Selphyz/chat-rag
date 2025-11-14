# AI Agents Guide - Chat RAG Backend

**Purpose:** This guide helps AI assistants (ChatGPT, Claude, Copilot, etc.) understand and work effectively with this NestJS RAG chat application.

---

## 🎯 What This Application Does

This is a **RAG (Retrieval-Augmented Generation)** chat backend that enables intelligent conversations grounded in user-uploaded documents.

**User Journey:**
1. User uploads documents (PDFs, Word docs, Excel, text files, code)
2. System processes documents → extracts text → splits into chunks → creates embeddings
3. User asks questions in chat
4. System finds relevant document chunks → provides context to AI → AI answers based on documents
5. User gets accurate, source-grounded responses instead of hallucinations

**Think of it as:** "ChatGPT that actually knows about YOUR specific documents."

---

## 🏗️ System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│                    NestJS Backend                       │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │   Auth     │  │  Documents │  │   Embeddings     │   │
│  │   (JWT)    │  │  (Upload)  │  │  (LangChain)     │   │
│  └────────────┘  └────────────┘  └──────────────────┘   │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │   Chat     │  │  Ollama    │  │    Qdrant        │   │
│  │  (RAG)     │  │  (LLM)     │  │  (Vectors)       │   │
│  └────────────┘  └────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
           ↓              ↓                ↓
    ┌──────────┐   ┌──────────┐    ┌──────────┐
    │PostgreSQL│   │  Ollama  │    │  Qdrant  │
    │  (Data)  │   │(Llama3.2)│    │ (Search) │
    └──────────┘   └──────────┘    └──────────┘
```

### Data Flow

**Document Upload Flow:**
```
User uploads file
  → DocumentsController.uploadDocument()
  → Save to disk + create Document entity (status: processing)
  → EmbeddingsService.processDocument() [ASYNC]
     → Parse file to text
     → Split into chunks (LangChain)
     → Generate embeddings (Ollama nomic-embed-text)
     → Store chunks in PostgreSQL
     → Store vectors in Qdrant
     → Update status: processed
```

**Chat Message Flow:**
```
User sends message
  → ChatController.sendMessage()
  → ChatService.sendMessage()
     → Save user message
     → EmbeddingsService.searchRelevantChunks() [RAG RETRIEVAL]
        → Generate query embedding
        → Search Qdrant (cosine similarity)
        → Return top 5 chunks
     → Build prompt with context
     → OllamaService.chat() [LLM GENERATION]
     → Save assistant message
     → Return response
```

---

## 📦 Module Breakdown

### 1. Auth Module (`src/modules/auth/`)

**Purpose:** User authentication and authorization

**Key Files:**
- `auth.service.ts` - Registration, login, token generation
- `jwt.strategy.ts` - Token validation
- `jwt-auth.guard.ts` - Global authentication guard

**How it works:**
- User registers → password hashed with bcrypt → JWT token issued
- All routes protected by default → use `@Public()` decorator to bypass
- `@CurrentUser()` decorator injects authenticated user into routes

**Common Tasks:**
- Modify token expiration: Update `JWT_EXPIRES_IN` in `.env`
- Add user fields: Update `User` entity and registration DTO
- Change auth strategy: Replace JWT strategy in auth module

---

### 2. Chat Module (`src/modules/chat/`)

**Purpose:** Manage chat sessions and messages with RAG pipeline

**Key Files:**
- `chat.service.ts` - Core RAG implementation
- `chat.controller.ts` - API endpoints
- `entities/chat.entity.ts` - Chat session model
- `entities/message.entity.ts` - Individual messages

**How it works:**
1. User creates chat session
2. User sends message → triggers RAG pipeline
3. System retrieves relevant context from user's documents
4. LLM generates response with context
5. Both messages saved to database

**RAG Pipeline (in `sendMessage()`):**
```typescript
// 1. Retrieve context
const context = await this.embeddingsService.searchRelevantChunks(
  userMessage,
  userId,
  topK: 5
);

// 2. Build system prompt with context
const systemPrompt = `You are an AI assistant. Use these documents:
${context}
Answer the user's question based on the context.`;

// 3. Get chat history
const history = await this.getChatHistory(chatId);

// 4. Generate response
const response = await this.ollamaService.chat([
  { role: 'system', content: systemPrompt },
  ...history,  // Previous conversation
  { role: 'user', content: userMessage }
]);
```

**Common Tasks:**
- Adjust context size: Change `RETRIEVAL_TOP_K` in `.env`
- Modify system prompt: Edit `buildSystemPrompt()` in `chat.service.ts`
- Add chat features: Extend ChatService (e.g., chat sharing, export)

---

### 3. Documents Module (`src/modules/documents/`)

**Purpose:** Handle file uploads and text extraction

**Key Files:**
- `documents.service.ts` - File management
- `documents.controller.ts` - Upload endpoint
- `parsers/` - File type-specific parsers

**Supported File Types:**
| Type | Parser | Library |
|------|--------|---------|
| PDF | `pdf.parser.ts` | pdf-parse |
| DOCX | `docx.parser.ts` | mammoth |
| XLSX | `xlsx.parser.ts` | xlsx |
| TXT/MD | `text.parser.ts` | Native UTF-8 |
| Code | `text.parser.ts` | Native UTF-8 |

**How it works:**
1. User uploads file → Multer validates type/size
2. File saved to `./uploads/` directory
3. Document entity created with status: `processing`
4. Parser extracts text based on MIME type
5. Text passed to embeddings service

**Common Tasks:**
- Add file type: Create new parser, add to `parseDocument()` method
- Change upload limit: Update `MAX_FILE_SIZE` in `.env`
- Add validation: Modify `FileInterceptor` options in controller

---

### 4. Embeddings Module (`src/modules/embeddings/`)

**Purpose:** Orchestrate document chunking and vector storage

**Key Files:**
- `embeddings.service.ts` - Main orchestrator

**Process:**
```typescript
processDocument(documentId) {
  // 1. Parse document (via DocumentsService)
  const text = await this.documentsService.parseDocument(documentId);

  // 2. Split into chunks (LangChain)
  const chunks = await this.textSplitter.createDocuments([text]);
  // Result: ["chunk 1 (1000 chars)", "chunk 2 (1000 chars)", ...]

  // 3. Generate embeddings (Ollama)
  const embeddings = await this.ollamaService.generateEmbeddings(
    chunks.map(c => c.pageContent)
  );
  // Result: [[0.123, 0.456, ...], [0.789, 0.012, ...]]

  // 4. Store chunks in PostgreSQL
  for (let i = 0; i < chunks.length; i++) {
    await this.chunkRepository.save({
      documentId,
      chunkIndex: i,
      content: chunks[i].pageContent,
      vectorId: `${documentId}-chunk-${i}`
    });
  }

  // 5. Store vectors in Qdrant (batch)
  await this.qdrantService.insertVectors(vectorPoints);

  // 6. Update document status
  await this.documentsService.updateStatus(documentId, 'processed');
}
```

**Chunking Strategy:**
- Uses LangChain's `RecursiveCharacterTextSplitter`
- Default: 1000 chars per chunk, 200 char overlap
- Overlap ensures context isn't lost at boundaries

**Common Tasks:**
- Adjust chunk size: Update `CHUNK_SIZE` and `CHUNK_OVERLAP` in `.env`
- Change splitting strategy: Modify `textSplitter` initialization
- Add preprocessing: Insert text cleaning before chunking

---

### 5. Ollama Module (`src/modules/ollama/`)

**Purpose:** Wrapper for Ollama LLM API

**Key Files:**
- `ollama.service.ts` - API client

**Capabilities:**
```typescript
// Chat completion
await ollamaService.chat(messages, {
  temperature: 0.7,  // Creativity (0-1)
  topP: 0.9,         // Nucleus sampling
  maxTokens: 2000    // Response length limit
});

// Embedding generation
await ollamaService.generateEmbedding(text);
// Returns: [0.123, 0.456, ...] (768-dim vector)

// Batch embeddings
await ollamaService.generateEmbeddings([text1, text2, text3]);

// Health check
await ollamaService.healthCheck();
```

**Models Used:**
- `llama3.2` - Chat responses (default)
- `nomic-embed-text` - Embeddings (768 dimensions)

**Common Tasks:**
- Change model: Update `OLLAMA_MODEL` in `.env`
- Adjust temperature: Modify options in `chat()` calls
- Add streaming: Implement `chatStream()` method with SSE

---

### 6. Qdrant Module (`src/modules/qdrant/`)

**Purpose:** Vector database operations for semantic search

**Key Files:**
- `qdrant.service.ts` - Qdrant client wrapper

**Core Operations:**
```typescript
// Insert vectors
await qdrantService.insertVectors([
  {
    id: "doc1-chunk-0",
    vector: [0.123, 0.456, ...],  // 768-dim embedding
    payload: {
      chunkId: "uuid",
      documentId: "uuid",
      userId: "uuid",
      content: "Actual text content...",
      metadata: { filename: "doc.pdf", chunkIndex: 0 }
    }
  }
]);

// Search (semantic similarity)
const results = await qdrantService.search(
  queryVector,  // User question embedding
  limit: 5,     // Top K results
  filter: { userId: "uuid" }  // Only user's documents
);
// Returns: [{ id, score, payload }, ...]

// Delete by document
await qdrantService.deleteDocumentVectors(documentId);
```

**Collection Structure:**
- Collection: `documents_collection`
- Vector size: 768 (matches nomic-embed-text)
- Distance metric: Cosine similarity

**Common Tasks:**
- Increase search results: Change `RETRIEVAL_TOP_K`
- Add metadata fields: Update payload structure
- Optimize search: Add indexes in collection config

---

## 🔐 Security & Authorization

### Authentication Pattern

**Default:** All routes require JWT authentication

**Opt-out:** Use `@Public()` decorator
```typescript
@Public()
@Get('health')
async healthCheck() { ... }
```

### Authorization Pattern

**Critical:** Always filter by user ID

```typescript
// ✅ CORRECT - User can only see their own data
const chats = await this.chatRepository.find({
  where: { userId: user.id }
});

// ❌ WRONG - Exposes all users' data
const chats = await this.chatRepository.find();
```

**Ownership Checks:**
```typescript
const document = await this.findById(id);
if (document.userId !== user.id) {
  throw new BadRequestException('Access denied');
}
```

### Vector Search Security

**Filtered Search:**
```typescript
// Always search within user's documents only
const results = await qdrantService.searchByUser(
  queryVector,
  userId,  // ← CRITICAL: Filter by user
  limit
);
```

---

## 🗄️ Database Schema

### Entity Relationships

```
User (email, password)
 │
 ├─→ Chat (title)
 │    └─→ Message (role, content)
 │
 └─→ Document (filename, status)
      └─→ DocumentChunk (content, vectorId)
           └─→ [Qdrant Vector]
```

### Key Points

1. **Cascade Deletes:**
   - Delete user → deletes chats, documents
   - Delete chat → deletes messages
   - Delete document → deletes chunks

2. **Status Tracking:**
   - Documents have status: `processing` | `processed` | `failed`
   - Allows async processing with status polling

3. **Vector Linking:**
   - Each chunk has `vectorId` linking to Qdrant
   - Enables cleanup when documents are deleted

---

## 🔄 Common Workflows

### Add a New API Endpoint

1. **Create DTO** (validation)
   ```typescript
   // src/modules/chat/dto/update-chat.dto.ts
   export class UpdateChatDto {
     @IsString()
     @MaxLength(200)
     title: string;
   }
   ```

2. **Add Service Method** (business logic)
   ```typescript
   // chat.service.ts
   async updateChat(id: string, userId: string, dto: UpdateChatDto) {
     const chat = await this.getChatById(id, userId);
     chat.title = dto.title;
     return this.chatRepository.save(chat);
   }
   ```

3. **Add Controller Route**
   ```typescript
   // chat.controller.ts
   @Patch(':id')
   async updateChat(
     @Param('id') id: string,
     @Body() dto: UpdateChatDto,
     @CurrentUser() user: User,
   ) {
     return this.chatService.updateChat(id, user.id, dto);
   }
   ```

---

### Add a New Database Entity

1. **Create Entity**
   ```typescript
   // entities/tag.entity.ts
   @Entity('tags')
   export class Tag {
     @PrimaryGeneratedColumn('uuid')
     id: string;

     @Column()
     name: string;

     @Column({ name: 'user_id' })
     userId: string;

     @ManyToOne(() => User)
     @JoinColumn({ name: 'user_id' })
     user: User;
   }
   ```

2. **Add to Module**
   ```typescript
   @Module({
     imports: [TypeOrmModule.forFeature([Tag])],
   })
   ```

3. **Generate Migration**
   ```bash
   npm run migration:generate -- src/database/migrations/AddTagsTable
   npm run migration:run
   ```

---

### Integrate New External Service

1. **Create Module**
   ```bash
   nest g module modules/service-name
   nest g service modules/service-name
   ```

2. **Implement Service**
   ```typescript
   @Injectable()
   export class ServiceNameService {
     private client;

     constructor(private configService: ConfigService) {
       this.client = new ExternalClient({
         apiKey: configService.get('serviceName.apiKey'),
       });
     }

     async doSomething() {
       return this.client.call();
     }
   }
   ```

3. **Export and Use**
   ```typescript
   // module
   @Module({
     providers: [ServiceNameService],
     exports: [ServiceNameService],
   })

   // usage
   constructor(private serviceNameService: ServiceNameService) {}
   ```

---

## 🧪 Testing

### Unit Test Pattern

```typescript
describe('ChatService', () => {
  let service: ChatService;
  let mockRepository;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Chat), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should create chat', async () => {
    mockRepository.save.mockResolvedValue({ id: '123', title: 'Test' });
    const result = await service.createChat('user-id', 'Test');
    expect(result.id).toBe('123');
  });
});
```

### E2E Test Pattern

```typescript
it('should complete full chat flow', async () => {
  // 1. Register
  const auth = await request(app)
    .post('/api/auth/register')
    .send({ email: 'test@test.com', password: 'pass123' });

  const token = auth.body.access_token;

  // 2. Create chat
  const chat = await request(app)
    .post('/api/chats')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Test Chat' });

  // 3. Send message
  const message = await request(app)
    .post(`/api/chats/${chat.body.id}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ message: 'Hello!' })
    .expect(201);

  expect(message.body.assistantMessage).toBeDefined();
});
```

---

## 🐛 Troubleshooting

### "Cannot connect to PostgreSQL"

**Cause:** Database not running or wrong host
**Fix:**
```bash
# Check status
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

---

### "Qdrant collection not found"

**Cause:** Collection auto-creation failed
**Fix:**
```bash
# Check Qdrant is running
curl http://localhost:6333/health

# Restart app to retry collection creation
docker-compose restart app
```

---

### "Ollama model not found"

**Cause:** Models not pulled
**Fix:**
```bash
# Pull LLM model
docker exec -it chatrag-ollama ollama pull llama3.2

# Pull embedding model
docker exec -it chatrag-ollama ollama pull nomic-embed-text

# Verify
docker exec -it chatrag-ollama ollama list
```

---

### "Vector dimension mismatch"

**Cause:** Embedding dimension doesn't match Qdrant collection
**Fix:**
1. Check actual embedding dimension:
   ```bash
   curl -X POST http://localhost:3000/api/ollama/test-embedding \
     -H "Content-Type: application/json" \
     -d '{"message":"test"}'
   ```
2. Update `.env`: `EMBEDDING_DIMENSION=768`
3. Recreate Qdrant collection or update dimension

---

### "Document processing stuck"

**Cause:** Background processing failed
**Fix:**
1. Check document status: GET `/api/documents/:id`
2. Check error field in response
3. Reprocess: POST `/api/documents/:id/reprocess`

---

## 🎓 Key Concepts for AI Agents

### Understanding RAG

**Traditional LLM:** User question → LLM → Answer (may hallucinate)

**RAG System:** User question → Retrieve relevant docs → LLM + Context → Grounded answer

**Benefits:**
- ✅ Accurate answers based on actual data
- ✅ Reduces hallucinations
- ✅ Works with private/proprietary information
- ✅ Updatable knowledge (just add documents)

---

### Vector Embeddings Explained

**Text:** "The cat sat on the mat"
**Embedding:** [0.123, -0.456, 0.789, ..., 0.234] (768 numbers)

**Key Property:** Similar meanings → Similar vectors

**Example:**
```
"The cat sat on the mat"     → [0.1, 0.2, 0.3, ...]
"A feline rested on a rug"   → [0.11, 0.19, 0.31, ...]  ← Similar!
"Database migration failed"  → [0.9, -0.5, -0.2, ...]  ← Different!
```

**How Search Works:**
1. User asks: "Where did the cat sit?"
2. Convert to embedding: [0.09, 0.21, 0.29, ...]
3. Find closest vectors in database (cosine similarity)
4. Return matching text chunks

---

### Async Processing Pattern

**Why:** Document processing is slow (parsing + embedding generation)

**Pattern:**
1. Synchronous: Save file + create database record (status: processing)
2. Return immediately to user
3. Asynchronous: Process in background
4. User polls status or gets notified when complete

**Implementation:**
```typescript
// Controller - returns immediately
async uploadDocument(file, user) {
  const doc = await this.service.uploadDocument(file, user.id);

  // Fire and forget (don't await)
  this.embeddingsService.processDocument(doc.id)
    .catch(err => console.error('Processing failed:', err));

  return { id: doc.id, status: 'processing' };
}
```

---

## 📚 Helpful Tips for AI Agents

### When Helping Users...

1. **Always check authentication requirements**
   - Most endpoints need JWT
   - Use `@Public()` only for login/register/health

2. **Verify data isolation**
   - Queries must filter by `userId`
   - Check ownership before operations

3. **Consider async operations**
   - Document processing takes time
   - Don't block user requests

4. **Remember the RAG pipeline**
   - Upload → Parse → Chunk → Embed → Store
   - Chat → Retrieve → Generate → Save

5. **Check configuration**
   - Most settings in `.env` / ConfigService
   - Don't hardcode values

### Common User Questions

**"How do I change the AI model?"**
→ Update `OLLAMA_MODEL` in `.env` and pull the model

**"How can I increase context in responses?"**
→ Increase `RETRIEVAL_TOP_K` (more chunks) or `CHUNK_SIZE` (bigger chunks)

**"Why is my document processing slow?"**
→ Ollama embedding generation is CPU-intensive, consider GPU acceleration

**"Can I use OpenAI instead of Ollama?"**
→ Yes, create new service similar to `OllamaService` using OpenAI SDK

**"How do I add streaming responses?"**
→ Implement SSE in chat controller, use `ollamaService.chatStream()`

---

## 🚀 Quick Reference

### Environment Variables
```bash
DATABASE_HOST=postgres        # PostgreSQL host
JWT_SECRET=<64-char-hex>     # Generate with crypto.randomBytes(32).toString('hex')
OLLAMA_MODEL=llama3.2        # LLM for chat
EMBEDDING_MODEL=nomic-embed-text  # Model for embeddings
EMBEDDING_DIMENSION=768      # Must match embedding model output
CHUNK_SIZE=1000              # Characters per chunk
CHUNK_OVERLAP=200            # Overlap between chunks
RETRIEVAL_TOP_K=5            # Number of chunks to retrieve
```

### Docker Commands
```bash
docker-compose up -d                    # Start all services
docker-compose logs -f app              # View app logs
docker-compose ps                       # Check status
docker exec -it chatrag-ollama ollama list  # List models
docker-compose down                     # Stop all
docker-compose down -v                  # Stop + delete data
```

### NPM Scripts
```bash
npm run start:dev           # Development mode (watch)
npm run build               # Compile TypeScript
npm test                    # Run unit tests
npm run test:e2e            # Run E2E tests
npm run migration:generate  # Create migration
npm run migration:run       # Apply migrations
```

### API Endpoints
```
POST   /api/auth/register              # Create user
POST   /api/auth/login                 # Login
GET    /api/auth/profile               # Get current user
POST   /api/chats                      # Create chat
GET    /api/chats                      # List chats
POST   /api/chats/:id/messages         # Send message (RAG)
POST   /api/documents/upload           # Upload file
GET    /api/documents                  # List documents
GET    /api/health                     # System status
GET    /api/docs                       # Swagger UI
```

---

## 🤝 Contributing Guidelines

When suggesting code changes:

1. **Follow existing patterns** - Study similar code first
2. **Add proper validation** - Use DTOs with decorators
3. **Include error handling** - Throw appropriate exceptions
4. **Consider security** - Filter by userId, validate ownership
5. **Write tests** - At minimum, unit test the service
6. **Update documentation** - If adding features, update this file

---

## 📖 Additional Resources

- **PRD.md** - Complete product requirements
- **STEP-XX-*.md** - Step-by-step implementation guides
- **CLAUDE.md** - Claude-specific development guide
- **Swagger Docs** - http://localhost:3000/api/docs (when running)

---

**Remember:** This is a RAG system. The magic happens when documents are transformed into searchable vectors that enhance AI responses. Help users understand this pipeline, and they'll build amazing applications!
