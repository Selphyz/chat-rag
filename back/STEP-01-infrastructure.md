# Step 1: Infrastructure & Configuration

**Estimated Time:** 2-3 hours
**Prerequisites:** Docker and Docker Compose installed

---

## Overview

In this step, we'll set up the foundational infrastructure for the RAG chat application:
- Docker Compose configuration for all services
- Environment variable management
- Configuration module setup
- Project folder structure

---

## 1. Docker Compose Setup

### 1.1 Create `docker-compose.yml`

Create a Docker Compose file to orchestrate all required services:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: chatrag-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DATABASE_NAME:-chatrag}
      POSTGRES_USER: ${DATABASE_USER:-postgres}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-postgres}
    ports:
      - "${DATABASE_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - chatrag-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:v1.7.4
    container_name: chatrag-qdrant
    restart: unless-stopped
    ports:
      - "${QDRANT_PORT:-6333}:6333"
      - "6334:6334"  # gRPC port
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - chatrag-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:6333/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Ollama LLM Runtime
  ollama:
    image: ollama/ollama:latest
    container_name: chatrag-ollama
    restart: unless-stopped
    ports:
      - "${OLLAMA_PORT:-11434}:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - chatrag-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:11434/api/tags || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # NestJS Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: chatrag-app
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3000
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: ${DATABASE_NAME:-chatrag}
      DATABASE_USER: ${DATABASE_USER:-postgres}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD:-postgres}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}
      OLLAMA_HOST: http://ollama:11434
      OLLAMA_MODEL: ${OLLAMA_MODEL:-llama3.2}
      QDRANT_HOST: qdrant
      QDRANT_PORT: 6333
      QDRANT_COLLECTION: ${QDRANT_COLLECTION:-documents_collection}
      EMBEDDING_MODEL: ${EMBEDDING_MODEL:-nomic-embed-text}
      EMBEDDING_DIMENSION: ${EMBEDDING_DIMENSION:-768}
      MAX_FILE_SIZE: ${MAX_FILE_SIZE:-10485760}
      CHUNK_SIZE: ${CHUNK_SIZE:-1000}
      CHUNK_OVERLAP: ${CHUNK_OVERLAP:-200}
    volumes:
      - ./src:/app/src
      - ./uploads:/app/uploads
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      ollama:
        condition: service_healthy
    networks:
      - chatrag-network
    command: npm run start:dev

volumes:
  postgres_data:
    driver: local
  qdrant_data:
    driver: local
  ollama_data:
    driver: local

networks:
  chatrag-network:
    driver: bridge
```

### 1.2 Create `Dockerfile`

```dockerfile
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "start:dev"]

# Production build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
```

### 1.3 Create `.dockerignore`

```
node_modules
dist
npm-debug.log
.env
.env.local
.git
.gitignore
README.md
.vscode
.idea
coverage
uploads
*.log
```

---

## 2. Environment Configuration

### 2.1 Create `.env.example`

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

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Ollama Configuration
OLLAMA_HOST=http://ollama:11434
OLLAMA_PORT=11434
OLLAMA_MODEL=llama3.2
EMBEDDING_MODEL=nomic-embed-text

# Qdrant Configuration
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION=documents_collection
EMBEDDING_DIMENSION=768

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Document Processing
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
RETRIEVAL_TOP_K=5

# Logging
LOG_LEVEL=debug
```

### 2.2 Create `.env` (for local development)

Copy `.env.example` to `.env` and update values:
```bash
cp .env.example .env
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Install Dependencies

### 3.1 Core NestJS Dependencies

```bash
npm install @nestjs/config @nestjs/typeorm @nestjs/passport @nestjs/jwt @nestjs/swagger @nestjs/platform-express
```

### 3.2 Database & ORM

```bash
npm install typeorm pg
```

### 3.3 Authentication

```bash
npm install passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

### 3.4 Vector Database

```bash
npm install @qdrant/js-client-rest
```

### 3.5 LLM & Document Processing

```bash
npm install ollama langchain @langchain/community pdf-parse mammoth xlsx
npm install -D @types/pdf-parse
```

### 3.6 Validation & Utilities

```bash
npm install class-validator class-transformer
```

### 3.7 File Upload

```bash
npm install @types/multer
```

---

## 4. NestJS Configuration Module

### 4.1 Update `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 4.2 Create `src/config/configuration.ts`

```typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    name: process.env.DATABASE_NAME || 'chatrag',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
  },

  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT, 10) || 6333,
    collection: process.env.QDRANT_COLLECTION || 'documents_collection',
    embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION, 10) || 768,
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },

  chunking: {
    chunkSize: parseInt(process.env.CHUNK_SIZE, 10) || 1000,
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP, 10) || 200,
    retrievalTopK: parseInt(process.env.RETRIEVAL_TOP_K, 10) || 5,
  },
});
```

---

## 5. Project Structure

### 5.1 Create Folder Structure

```bash
mkdir -p src/modules/auth/dto
mkdir -p src/modules/auth/guards
mkdir -p src/modules/auth/strategies
mkdir -p src/modules/chat/dto
mkdir -p src/modules/documents/dto
mkdir -p src/modules/documents/parsers
mkdir -p src/modules/embeddings
mkdir -p src/modules/ollama
mkdir -p src/modules/qdrant
mkdir -p src/common/decorators
mkdir -p src/common/filters
mkdir -p src/common/interceptors
mkdir -p src/common/guards
mkdir -p uploads
```

### 5.2 Expected Project Structure

```
back/
├── src/
│   ├── common/                    # Shared utilities
│   │   ├── decorators/           # Custom decorators
│   │   ├── filters/              # Exception filters
│   │   ├── guards/               # Auth guards
│   │   └── interceptors/         # Response interceptors
│   ├── config/                   # Configuration
│   │   └── configuration.ts
│   ├── modules/
│   │   ├── auth/                 # Authentication module
│   │   │   ├── dto/
│   │   │   ├── guards/
│   │   │   ├── strategies/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── chat/                 # Chat management
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   └── chat.module.ts
│   │   ├── documents/            # Document management
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   ├── parsers/
│   │   │   ├── documents.controller.ts
│   │   │   ├── documents.service.ts
│   │   │   └── documents.module.ts
│   │   ├── embeddings/           # Embedding generation
│   │   │   ├── embeddings.service.ts
│   │   │   └── embeddings.module.ts
│   │   ├── ollama/               # Ollama integration
│   │   │   ├── ollama.service.ts
│   │   │   └── ollama.module.ts
│   │   └── qdrant/               # Qdrant integration
│   │       ├── qdrant.service.ts
│   │       └── qdrant.module.ts
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts
├── test/
├── uploads/                      # Uploaded files
├── .env
├── .env.example
├── .dockerignore
├── docker-compose.yml
├── Dockerfile
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. Update `.gitignore`

Add the following to `.gitignore`:

```
# Environment
.env
.env.local
.env.*.local

# Uploads
uploads/
temp/

# Database
*.db
*.sqlite

# Docker
docker-compose.override.yml

# Logs
logs/
*.log
npm-debug.log*
```

---

## 7. Validation & Testing

### 7.1 Verify Docker Services

Start all services:
```bash
docker-compose up -d
```

Check service status:
```bash
docker-compose ps
```

Expected output:
```
chatrag-postgres    running    0.0.0.0:5432->5432/tcp
chatrag-qdrant      running    0.0.0.0:6333->6333/tcp
chatrag-ollama      running    0.0.0.0:11434->11434/tcp
```

### 7.2 Test Service Connectivity

**PostgreSQL:**
```bash
docker exec -it chatrag-postgres psql -U postgres -d chatrag -c "SELECT version();"
```

**Qdrant:**
```bash
curl http://localhost:6333/health
```

Expected: `{"status":"ok"}`

**Ollama:**
```bash
curl http://localhost:11434/api/tags
```

### 7.3 Pull Ollama Models

Pull required models (this may take time):
```bash
docker exec -it chatrag-ollama ollama pull llama3.2
docker exec -it chatrag-ollama ollama pull nomic-embed-text
```

Verify models:
```bash
docker exec -it chatrag-ollama ollama list
```

### 7.4 Test NestJS Application

Build and start the application:
```bash
npm install
npm run start:dev
```

Test the health endpoint:
```bash
curl http://localhost:3000/
```

Expected: `Hello World!`

---

## 8. Health Check Endpoints

### 8.1 Create `src/app.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
```

---

## 9. Common Pitfalls & Troubleshooting

### Issue: Port Already in Use
**Solution:** Change ports in `.env` or stop conflicting services
```bash
sudo lsof -i :3000
kill -9 <PID>
```

### Issue: Docker Services Won't Start
**Solution:** Check Docker logs
```bash
docker-compose logs <service-name>
```

### Issue: Ollama Models Download Slowly
**Solution:** Download models before starting app
```bash
docker-compose up -d ollama
docker exec -it chatrag-ollama ollama pull llama3.2
```

### Issue: PostgreSQL Connection Refused
**Solution:** Wait for health check to pass
```bash
docker-compose ps
docker-compose logs postgres
```

---

## 10. Next Steps

✅ **Step 1 Complete! You should now have:**
- Docker Compose with all services running
- Environment configuration setup
- NestJS app with configuration module
- Proper project structure
- Health check endpoints

**Continue to Step 2:** Database Setup with TypeORM

---

## Commands Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f app

# Rebuild app container
docker-compose up -d --build app

# Access database
docker exec -it chatrag-postgres psql -U postgres -d chatrag

# Check Ollama models
docker exec -it chatrag-ollama ollama list

# Clean up volumes (CAUTION: deletes data)
docker-compose down -v
```
