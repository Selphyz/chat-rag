# Product Requirements Document (PRD)
## RAG-Based Chat Application Backend

**Version:** 1.0
**Date:** 2025-11-14
**Project:** Chat RAG Backend with NestJS

---

## 1. Executive Summary

This document outlines the requirements for building a backend API for a RAG (Retrieval-Augmented Generation) chat application similar to ChatGPT, but with the ability to upload, vectorize, and query custom documents. The application will use Llama 3.2 via Ollama for AI responses, Qdrant for vector storage, and PostgreSQL for structured data.

---

## 2. Product Overview

### 2.1 Purpose
Create a backend service that enables users to:
- Chat with an AI assistant (Llama 3.2)
- Upload and manage documents
- Ask questions about uploaded documents using RAG
- Manage multiple chat sessions
- Authenticate securely with JWT

### 2.2 Target Users
- Developers building AI-powered chat applications
- Teams needing document-based Q&A systems
- Organizations requiring private, self-hosted AI solutions

### 2.3 Key Differentiators
- Self-hosted with Ollama (no external API costs)
- Document vectorization for contextual responses
- Multi-user support with authentication
- Support for multiple file formats
- Full chat history persistence

---

## 3. Technical Architecture

### 3.1 Technology Stack

**Backend Framework:**
- NestJS v11 with TypeScript
- Node.js with Express

**Databases:**
- PostgreSQL (structured data: users, chats, messages, document metadata)
- Qdrant (vector database for document embeddings)

**AI/ML:**
- Ollama (LLM runtime for Llama 3.2)
- LangChain (text splitting and document processing)

**Authentication:**
- JWT (JSON Web Tokens)
- Passport.js with JWT strategy
- bcrypt for password hashing

**File Processing:**
- pdf-parse (PDF extraction)
- mammoth (DOCX processing)
- xlsx (Excel files)
- Native support for text, markdown, and code files

**Infrastructure:**
- Docker & Docker Compose
- Environment-based configuration

### 3.2 System Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────────────────────────────┐
│         NestJS Backend              │
│  ┌────────────────────────────┐    │
│  │  Auth Module (JWT)         │    │
│  ├────────────────────────────┤    │
│  │  Chat Module               │    │
│  ├────────────────────────────┤    │
│  │  Documents Module          │    │
│  ├────────────────────────────┤    │
│  │  Embeddings Module         │    │
│  ├────────────────────────────┤    │
│  │  Ollama Service            │    │
│  ├────────────────────────────┤    │
│  │  Qdrant Service            │    │
│  └────────────────────────────┘    │
└────┬──────────┬─────────┬──────────┘
     │          │         │
     ▼          ▼         ▼
┌──────────┐ ┌────────┐ ┌────────┐
│PostgreSQL│ │ Qdrant │ │ Ollama │
└──────────┘ └────────┘ └────────┘
```

---

## 4. Functional Requirements

### 4.1 User Authentication

**FR-AUTH-001: User Registration**
- Users can register with email and password
- Password must be hashed using bcrypt
- Email must be unique
- Return JWT token upon successful registration

**FR-AUTH-002: User Login**
- Users can login with email and password
- Return JWT token upon successful authentication
- Token should be valid for 7 days

**FR-AUTH-003: Protected Routes**
- All chat and document endpoints require authentication
- JWT token must be validated for each request
- Invalid/expired tokens return 401 Unauthorized

### 4.2 Chat Management

**FR-CHAT-001: Create Chat Session**
- Authenticated users can create new chat sessions
- Each chat has a title (auto-generated or user-provided)
- Each chat belongs to a specific user
- Return chat ID and metadata

**FR-CHAT-002: List Chat Sessions**
- Users can retrieve all their chat sessions
- Return list sorted by most recent activity
- Include basic metadata (title, created date, message count)

**FR-CHAT-003: Get Chat Messages**
- Users can retrieve all messages for a specific chat
- Messages include role (user/assistant), content, timestamp
- Support pagination (optional for v1)

**FR-CHAT-004: Delete Chat Session**
- Users can delete their own chat sessions
- Cascade delete all associated messages
- Return success confirmation

### 4.3 Chat Interaction

**FR-MSG-001: Send Message**
- Users can send messages to a chat session
- Message is saved to database
- System retrieves relevant document context (if documents exist)
- AI generates response using Ollama + context
- AI response is saved to database
- Return AI response to user

**FR-MSG-002: Context Retrieval (RAG)**
- For each user message, search Qdrant for relevant document chunks
- Retrieve top K relevant chunks (K=3-5)
- Include chunks in LLM prompt as context
- If no documents exist, skip RAG and use base LLM

**FR-MSG-003: Streaming Support (Optional for v1)**
- Support streaming responses from Ollama
- Stream chunks to client via Server-Sent Events (SSE)

### 4.4 Document Management

**FR-DOC-001: Upload Document**
- Users can upload files (PDF, TXT, MD, DOCX, XLSX, code files)
- Maximum file size: 10MB per file
- Validate file type based on extension and MIME type
- Extract text content from file
- Store document metadata in PostgreSQL
- Return document ID and metadata

**FR-DOC-002: Process Document**
- Split document text into chunks using LangChain splitters
- Generate embeddings for each chunk
- Store chunks and embeddings in Qdrant
- Link chunks to document and user
- Update document status to "processed"

**FR-DOC-003: List Documents**
- Users can retrieve all their uploaded documents
- Return metadata: filename, size, type, upload date, status
- Filter by document status (processing/processed/failed)

**FR-DOC-004: Delete Document**
- Users can delete their own documents
- Remove document metadata from PostgreSQL
- Remove associated vectors from Qdrant
- Return success confirmation

**FR-DOC-005: Get Document Details**
- Users can view details of a specific document
- Return metadata and processing statistics
- Optionally return list of chunks

### 4.5 Supported File Types

**FR-FILE-001: PDF Files**
- Extract text using pdf-parse
- Preserve paragraph structure
- Handle multi-page documents

**FR-FILE-002: Text Files (TXT, MD)**
- Read as UTF-8
- Preserve line breaks and formatting

**FR-FILE-003: Office Documents (DOCX, XLSX)**
- DOCX: Extract text with mammoth
- XLSX: Extract cell contents and sheet names

**FR-FILE-004: Code Files**
- Support common extensions (.js, .ts, .py, .java, .cpp, etc.)
- Preserve code formatting
- Include file extension metadata

---

## 5. Non-Functional Requirements

### 5.1 Performance

**NFR-PERF-001: Response Time**
- API endpoints should respond within 200ms (excluding LLM generation)
- LLM generation time depends on Ollama (typically 2-10s)
- Document upload processing should complete within 30s for 10MB files

**NFR-PERF-002: Scalability**
- Support at least 100 concurrent users
- Handle 1000+ documents per user
- Vector search should complete within 100ms

### 5.2 Security

**NFR-SEC-001: Authentication**
- All passwords must be hashed with bcrypt (salt rounds: 10)
- JWT tokens must be signed with secure secret
- Tokens expire after 7 days

**NFR-SEC-002: Authorization**
- Users can only access their own chats and documents
- Implement row-level security checks
- Validate ownership for all CRUD operations

**NFR-SEC-003: File Upload Security**
- Validate file types before processing
- Scan for malicious content (basic checks)
- Store files in isolated directory
- Limit file size to prevent DoS

### 5.3 Reliability

**NFR-REL-001: Error Handling**
- All errors should return appropriate HTTP status codes
- Error messages should be user-friendly
- Log detailed errors for debugging

**NFR-REL-002: Data Persistence**
- PostgreSQL with ACID compliance
- Database migrations for schema changes
- Regular backups (deployment concern)

### 5.4 Maintainability

**NFR-MAIN-001: Code Quality**
- Follow NestJS best practices
- Use TypeScript strict mode
- Maintain 80%+ test coverage
- Use ESLint and Prettier

**NFR-MAIN-002: Documentation**
- API documentation with Swagger/OpenAPI
- Code comments for complex logic
- README with setup instructions
- Architecture diagrams

---

## 6. API Endpoints Specification

### 6.1 Authentication Endpoints

```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login user
GET    /api/auth/profile           # Get current user profile
```

### 6.2 Chat Endpoints

```
POST   /api/chats                  # Create new chat
GET    /api/chats                  # List all user's chats
GET    /api/chats/:id              # Get specific chat with messages
DELETE /api/chats/:id              # Delete chat
POST   /api/chats/:id/messages     # Send message to chat
```

### 6.3 Document Endpoints

```
POST   /api/documents              # Upload document (multipart/form-data)
GET    /api/documents              # List user's documents
GET    /api/documents/:id          # Get document details
DELETE /api/documents/:id          # Delete document
```

### 6.4 Health Check

```
GET    /api/health                 # System health status
GET    /api/health/ollama          # Ollama service status
GET    /api/health/qdrant          # Qdrant service status
```

---

## 7. Data Models

### 7.1 PostgreSQL Entities

**User Entity:**
```typescript
{
  id: UUID (primary key)
  email: string (unique)
  password: string (hashed)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Chat Entity:**
```typescript
{
  id: UUID (primary key)
  title: string
  userId: UUID (foreign key -> User)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Message Entity:**
```typescript
{
  id: UUID (primary key)
  chatId: UUID (foreign key -> Chat)
  role: enum ('user' | 'assistant')
  content: text
  createdAt: timestamp
}
```

**Document Entity:**
```typescript
{
  id: UUID (primary key)
  userId: UUID (foreign key -> User)
  filename: string
  originalName: string
  mimeType: string
  size: number (bytes)
  status: enum ('processing' | 'processed' | 'failed')
  error: text (nullable)
  uploadedAt: timestamp
  processedAt: timestamp (nullable)
}
```

**DocumentChunk Entity:**
```typescript
{
  id: UUID (primary key)
  documentId: UUID (foreign key -> Document)
  chunkIndex: number
  content: text
  vectorId: string (Qdrant point ID)
  createdAt: timestamp
}
```

### 7.2 Qdrant Collections

**documents_collection:**
```typescript
{
  vector: float[] (embedding dimension: 768 or 1024)
  payload: {
    chunkId: UUID
    documentId: UUID
    userId: UUID
    content: text
    metadata: {
      filename: string
      chunkIndex: number
    }
  }
}
```

---

## 8. Configuration & Environment

### 8.1 Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=chatrag
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Ollama
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=llama3.2

# Qdrant
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION=documents_collection

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Embeddings
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSION=768
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

---

## 9. Development Phases

### Phase 1: Infrastructure (Week 1)
- Docker Compose setup
- Environment configuration
- Database connection
- Base module structure

### Phase 2: Core Features (Week 2-3)
- Authentication system
- Database entities and migrations
- Ollama integration
- Qdrant integration

### Phase 3: Document Processing (Week 4)
- File upload endpoint
- Document parsers
- Text splitting
- Embedding generation

### Phase 4: RAG Implementation (Week 5)
- Chat module
- Message handling
- Context retrieval
- RAG pipeline

### Phase 5: Testing & Polish (Week 6)
- Unit tests
- E2E tests
- API documentation
- Performance optimization

---

## 10. Success Criteria

### 10.1 MVP Requirements
- [ ] Users can register and login
- [ ] Users can create and manage chats
- [ ] Users can send messages and receive AI responses
- [ ] Users can upload documents (at least PDF and TXT)
- [ ] Documents are vectorized and searchable
- [ ] RAG provides contextual answers from documents
- [ ] All data persists across restarts
- [ ] Docker Compose runs all services

### 10.2 Quality Metrics
- [ ] 80%+ test coverage
- [ ] API response time < 200ms (non-LLM)
- [ ] Zero critical security vulnerabilities
- [ ] Complete API documentation
- [ ] Setup time < 10 minutes with Docker

---

## 11. Future Enhancements (Post-MVP)

- **Streaming responses** with Server-Sent Events
- **Multiple LLM support** (switch between models)
- **Document preview** with highlighted chunks
- **Chat sharing** between users
- **Export chat history** to JSON/PDF
- **Rate limiting** to prevent abuse
- **Advanced search** across documents
- **Conversation memory** (summarization for long chats)
- **File storage** in S3/MinIO instead of local filesystem
- **Frontend application** with React/Next.js

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ollama downtime | High | Implement retry logic and error handling |
| Large file processing timeout | Medium | Async processing with job queue |
| Vector search performance degradation | Medium | Optimize Qdrant indexes, limit results |
| JWT token theft | High | Short expiration, secure storage recommendations |
| Document parsing failures | Medium | Graceful error handling, status tracking |

---

## 13. Dependencies

### 13.1 NPM Packages (Required)

**NestJS:**
- @nestjs/config
- @nestjs/typeorm
- @nestjs/passport
- @nestjs/jwt
- @nestjs/platform-express

**Database:**
- typeorm
- pg (PostgreSQL driver)

**Authentication:**
- passport
- passport-jwt
- bcrypt
- @types/bcrypt

**Vector Database:**
- @qdrant/js-client-rest

**LLM & Document Processing:**
- ollama (or axios for HTTP calls)
- langchain
- pdf-parse
- mammoth
- xlsx

**File Upload:**
- @nestjs/platform-express (includes multer)

**Utilities:**
- class-validator
- class-transformer

### 13.2 External Services

- PostgreSQL 15+
- Qdrant v1.7+
- Ollama with Llama 3.2 model

---

## 14. Glossary

- **RAG**: Retrieval-Augmented Generation - technique combining document retrieval with LLM generation
- **Embedding**: Vector representation of text for semantic search
- **Chunking**: Splitting documents into smaller segments for processing
- **LLM**: Large Language Model
- **Vector Database**: Database optimized for similarity search on high-dimensional vectors
- **JWT**: JSON Web Token for stateless authentication

---

**Document Control:**
- Created: 2025-11-14
- Last Updated: 2025-11-14
- Version: 1.0
- Owner: Development Team
