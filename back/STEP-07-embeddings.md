# Step 7: Embeddings & Vectorization

**Estimated Time:** 3 hours
**Prerequisites:** Steps 1-6 completed

---

## Overview

In this step, we'll implement document vectorization:
- Install LangChain for text splitting
- Create embeddings service
- Implement document chunking
- Generate embeddings using Ollama
- Store vectors in Qdrant
- Background processing for documents

---

## 1. Install Dependencies

```bash
npm install langchain @langchain/community
```

---

## 2. Embeddings Service

### 2.1 Create Embeddings Service - `src/modules/embeddings/embeddings.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document as LangchainDocument } from 'langchain/document';
import { OllamaService } from '../ollama/ollama.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { DocumentsService } from '../documents/documents.service';
import { Document, DocumentStatus } from '../documents/entities/document.entity';
import { DocumentChunk } from '../documents/entities/document-chunk.entity';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(
    @InjectRepository(DocumentChunk)
    private chunkRepository: Repository<DocumentChunk>,
    private configService: ConfigService,
    private ollamaService: OllamaService,
    private qdrantService: QdrantService,
    private documentsService: DocumentsService,
  ) {
    this.chunkSize = this.configService.get<number>('chunking.chunkSize');
    this.chunkOverlap = this.configService.get<number>('chunking.chunkOverlap');

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
  }

  /**
   * Process document: chunk, embed, and store
   */
  async processDocument(documentId: string): Promise<void> {
    try {
      this.logger.log(`Processing document: ${documentId}`);

      // Parse document text
      const text = await this.documentsService.parseDocument(documentId);

      // Split into chunks
      const chunks = await this.chunkText(text);
      this.logger.log(`Created ${chunks.length} chunks`);

      // Generate embeddings
      const embeddings = await this.generateEmbeddings(
        chunks.map((c) => c.pageContent),
      );
      this.logger.log(`Generated ${embeddings.length} embeddings`);

      // Store chunks and vectors
      await this.storeChunksAndVectors(documentId, chunks, embeddings);

      // Update document status
      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.PROCESSED,
      );

      this.logger.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to process document ${documentId}: ${error.message}`,
        error.stack,
      );

      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.FAILED,
        error.message,
      );

      throw error;
    }
  }

  /**
   * Chunk text using LangChain splitter
   */
  private async chunkText(text: string): Promise<LangchainDocument[]> {
    const documents = await this.textSplitter.createDocuments([text]);
    return documents;
  }

  /**
   * Generate embeddings for text chunks
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.ollamaService.generateEmbeddings(texts);
  }

  /**
   * Store chunks in PostgreSQL and vectors in Qdrant
   */
  private async storeChunksAndVectors(
    documentId: string,
    chunks: LangchainDocument[],
    embeddings: number[][],
  ): Promise<void> {
    const document = await this.documentsService.findById(documentId);

    // Prepare vector points for Qdrant
    const vectorPoints = [];

    // Create chunk records
    for (let i = 0; i < chunks.length; i++) {
      const vectorId = `${documentId}-chunk-${i}`;

      // Save chunk to PostgreSQL
      const chunk = this.chunkRepository.create({
        documentId: documentId,
        chunkIndex: i,
        content: chunks[i].pageContent,
        vectorId: vectorId,
      });

      await this.chunkRepository.save(chunk);

      // Prepare vector point for Qdrant
      vectorPoints.push({
        id: vectorId,
        vector: embeddings[i],
        payload: {
          chunkId: chunk.id,
          documentId: documentId,
          userId: document.userId,
          content: chunks[i].pageContent,
          metadata: {
            filename: document.originalName,
            chunkIndex: i,
          },
        },
      });
    }

    // Store vectors in Qdrant (batch)
    await this.qdrantService.insertVectors(vectorPoints);

    this.logger.log(
      `Stored ${chunks.length} chunks and vectors for document ${documentId}`,
    );
  }

  /**
   * Search for relevant chunks
   */
  async searchRelevantChunks(
    query: string,
    userId: string,
    limit: number = 5,
  ): Promise<Array<{ content: string; score: number; metadata: any }>> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.ollamaService.generateEmbedding(query);

      // Search in Qdrant
      const results = await this.qdrantService.searchByUser(
        queryEmbedding,
        userId,
        limit,
      );

      return results.map((r) => ({
        content: r.payload.content,
        score: r.score,
        metadata: r.payload.metadata,
      }));
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete all chunks and vectors for a document
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    try {
      // Delete from Qdrant
      await this.qdrantService.deleteDocumentVectors(documentId);

      // Delete chunks from PostgreSQL (cascade handles this)
      await this.chunkRepository.delete({ documentId });

      this.logger.log(`Deleted embeddings for document ${documentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete embeddings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
```

---

## 3. Embeddings Module

### 3.1 Create Module - `src/modules/embeddings/embeddings.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingsService } from './embeddings.service';
import { DocumentChunk } from '../documents/entities/document-chunk.entity';
import { OllamaModule } from '../ollama/ollama.module';
import { QdrantModule } from '../qdrant/qdrant.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentChunk]),
    OllamaModule,
    QdrantModule,
    DocumentsModule,
  ],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
```

---

## 4. Update Documents Module

### 4.1 Update Documents Controller to trigger processing

Update `src/modules/documents/documents.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'text/plain',
          'text/markdown',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];

        const allowedExtensions = [
          '.pdf',
          '.txt',
          '.md',
          '.docx',
          '.xlsx',
          '.js',
          '.ts',
          '.py',
          '.java',
          '.cpp',
          '.c',
          '.go',
          '.rs',
        ];

        const isAllowedMime = allowedMimes.includes(file.mimetype);
        const isAllowedExtension = allowedExtensions.some((ext) =>
          file.originalname.toLowerCase().endsWith(ext),
        );

        if (isAllowedMime || isAllowedExtension) {
          cb(null, true);
        } else {
          cb(new BadRequestException('File type not supported'), false);
        }
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const document = await this.documentsService.uploadDocument(file, user.id);

    // Process document asynchronously (don't await)
    this.embeddingsService
      .processDocument(document.id)
      .catch((error) => {
        console.error(`Background processing failed: ${error.message}`);
      });

    return {
      id: document.id,
      filename: document.originalName,
      size: document.size,
      status: document.status,
      uploadedAt: document.uploadedAt,
      message: 'Document uploaded and processing started',
    };
  }

  @Get()
  async listDocuments(@CurrentUser() user: User) {
    const documents = await this.documentsService.findAll(user.id);

    return documents.map((doc) => ({
      id: doc.id,
      filename: doc.originalName,
      size: doc.size,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
      processedAt: doc.processedAt,
      error: doc.error,
    }));
  }

  @Get(':id')
  async getDocument(@Param('id') id: string, @CurrentUser() user: User) {
    const document = await this.documentsService.findById(id);

    if (document.userId !== user.id) {
      throw new BadRequestException('Access denied');
    }

    return {
      id: document.id,
      filename: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: document.status,
      uploadedAt: document.uploadedAt,
      processedAt: document.processedAt,
      chunkCount: document.chunks?.length || 0,
      error: document.error,
    };
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @CurrentUser() user: User) {
    // Delete embeddings first
    await this.embeddingsService.deleteDocumentEmbeddings(id);

    // Then delete document
    await this.documentsService.delete(id, user.id);

    return {
      message: 'Document and embeddings deleted successfully',
    };
  }

  @Post(':id/reprocess')
  async reprocessDocument(@Param('id') id: string, @CurrentUser() user: User) {
    const document = await this.documentsService.findById(id);

    if (document.userId !== user.id) {
      throw new BadRequestException('Access denied');
    }

    // Delete old embeddings
    await this.embeddingsService.deleteDocumentEmbeddings(id);

    // Reprocess
    await this.embeddingsService.processDocument(id);

    return {
      message: 'Document reprocessing started',
    };
  }
}
```

### 4.2 Update Documents Module

Update `src/modules/documents/documents.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';
import { XlsxParser } from './parsers/xlsx.parser';
import { TextParser } from './parsers/text.parser';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentChunk]),
    EmbeddingsModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    PdfParser,
    DocxParser,
    XlsxParser,
    TextParser,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

---

## 5. Update App Module

Update `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { OllamaModule } from './modules/ollama/ollama.module';
import { QdrantModule } from './modules/qdrant/qdrant.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.user'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('nodeEnv') === 'development',
        logging: configService.get('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ChatModule,
    DocumentsModule,
    OllamaModule,
    QdrantModule,
    EmbeddingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
```

---

## 6. Testing Embeddings

### 6.1 Upload and Process Document

```bash
# Upload document (processing starts automatically)
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"

# Check document status
curl http://localhost:3000/api/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response should show status: "processed" and chunkCount
```

### 6.2 Check Qdrant

```bash
# Check vector count
curl http://localhost:3000/api/health/qdrant

# Or use Qdrant dashboard
open http://localhost:6333/dashboard
```

### 6.3 Reprocess Document

```bash
curl -X POST http://localhost:3000/api/documents/DOCUMENT_ID/reprocess \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 7. Next Steps

✅ **Step 7 Complete! You should now have:**
- LangChain text splitting
- Document chunking with overlap
- Embedding generation with Ollama
- Vector storage in Qdrant
- Chunk metadata in PostgreSQL
- Background processing for documents

**Continue to Step 8:** Chat Module with RAG

---

## Quick Commands Reference

```bash
# Upload and process
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@document.pdf"

# Check processing status
curl http://localhost:3000/api/documents/DOC_ID \
  -H "Authorization: Bearer TOKEN"

# Reprocess document
curl -X POST http://localhost:3000/api/documents/DOC_ID/reprocess \
  -H "Authorization: Bearer TOKEN"

# Check vector count in Qdrant
curl http://localhost:6333/collections/documents_collection
```
