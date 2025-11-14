# Step 6: Document Upload Module

**Estimated Time:** 3-4 hours
**Prerequisites:** Steps 1-5 completed

---

## Overview

In this step, we'll implement document upload functionality:
- File upload with Multer
- Support for multiple file types (PDF, TXT, MD, DOCX, XLSX, code files)
- Document parsing and text extraction
- Metadata storage in PostgreSQL
- File validation and security

---

## 1. Install Dependencies

```bash
npm install pdf-parse mammoth xlsx
npm install -D @types/pdf-parse @types/multer
```

---

## 2. File Parsers

### 2.1 PDF Parser - `src/modules/documents/parsers/pdf.parser.ts`

```typescript
import * as pdfParse from 'pdf-parse';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PdfParser {
  private readonly logger = new Logger(PdfParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      this.logger.error(`PDF parsing error: ${error.message}`);
      throw new Error('Failed to parse PDF file');
    }
  }
}
```

### 2.2 DOCX Parser - `src/modules/documents/parsers/docx.parser.ts`

```typescript
import * as mammoth from 'mammoth';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DocxParser {
  private readonly logger = new Logger(DocxParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      this.logger.error(`DOCX parsing error: ${error.message}`);
      throw new Error('Failed to parse DOCX file');
    }
  }
}
```

### 2.3 XLSX Parser - `src/modules/documents/parsers/xlsx.parser.ts`

```typescript
import * as XLSX from 'xlsx';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class XlsxParser {
  private readonly logger = new Logger(XlsxParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        text += `\n### Sheet: ${sheetName}\n${csv}\n`;
      });

      return text.trim();
    } catch (error) {
      this.logger.error(`XLSX parsing error: ${error.message}`);
      throw new Error('Failed to parse XLSX file');
    }
  }
}
```

### 2.4 Text Parser - `src/modules/documents/parsers/text.parser.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TextParser {
  private readonly logger = new Logger(TextParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      this.logger.error(`Text parsing error: ${error.message}`);
      throw new Error('Failed to parse text file');
    }
  }
}
```

---

## 3. Document Service

### 3.1 Create Document Service - `src/modules/documents/documents.service.ts`

```typescript
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Document, DocumentStatus } from './entities/document.entity';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';
import { XlsxParser } from './parsers/xlsx.parser';
import { TextParser } from './parsers/text.parser';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private configService: ConfigService,
    private pdfParser: PdfParser,
    private docxParser: DocxParser,
    private xlsxParser: XlsxParser,
    private textParser: TextParser,
  ) {
    this.uploadDir = this.configService.get<string>('upload.uploadDir');
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`);
    }
  }

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
  ): Promise<Document> {
    try {
      this.logger.log(`Uploading document: ${file.originalname} for user: ${userId}`);

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalname}`;
      const filepath = path.join(this.uploadDir, filename);

      // Save file to disk
      await fs.writeFile(filepath, file.buffer);

      // Create document record
      const document = this.documentRepository.create({
        userId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        status: DocumentStatus.PROCESSING,
      });

      await this.documentRepository.save(document);

      this.logger.log(`Document created with ID: ${document.id}`);

      return document;
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to upload document');
    }
  }

  async parseDocument(documentId: string): Promise<string> {
    const document = await this.findById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const filepath = path.join(this.uploadDir, document.filename);
    const buffer = await fs.readFile(filepath);

    try {
      let text: string;

      // Determine parser based on file type
      if (document.mimeType.includes('pdf')) {
        text = await this.pdfParser.parse(buffer);
      } else if (
        document.mimeType.includes('wordprocessingml') ||
        document.originalName.endsWith('.docx')
      ) {
        text = await this.docxParser.parse(buffer);
      } else if (
        document.mimeType.includes('spreadsheetml') ||
        document.originalName.endsWith('.xlsx')
      ) {
        text = await this.xlsxParser.parse(buffer);
      } else {
        text = await this.textParser.parse(buffer);
      }

      this.logger.log(`Parsed document ${documentId}: ${text.length} characters`);

      return text;
    } catch (error) {
      this.logger.error(`Parsing failed for ${documentId}: ${error.message}`);

      // Update document status
      await this.updateStatus(documentId, DocumentStatus.FAILED, error.message);

      throw new BadRequestException('Failed to parse document');
    }
  }

  async findAll(userId: string): Promise<Document[]> {
    return this.documentRepository.find({
      where: { userId },
      order: { uploadedAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['chunks'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    error?: string,
  ): Promise<void> {
    const updateData: any = { status };

    if (status === DocumentStatus.PROCESSED) {
      updateData.processedAt = new Date();
    }

    if (error) {
      updateData.error = error;
    }

    await this.documentRepository.update(id, updateData);
  }

  async delete(id: string, userId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id, userId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Delete file from disk
    const filepath = path.join(this.uploadDir, document.filename);
    try {
      await fs.unlink(filepath);
    } catch (error) {
      this.logger.warn(`Failed to delete file: ${filepath}`);
    }

    // Delete from database (cascades to chunks)
    await this.documentRepository.delete(id);

    this.logger.log(`Document ${id} deleted`);
  }

  async getUserDocumentCount(userId: string): Promise<number> {
    return this.documentRepository.count({ where: { userId } });
  }
}
```

---

## 4. DTOs

### 4.1 Upload Response DTO - `src/modules/documents/dto/document-response.dto.ts`

```typescript
import { DocumentStatus } from '../entities/document.entity';

export class DocumentResponseDto {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  uploadedAt: Date;
  processedAt?: Date;
  error?: string;
}
```

---

## 5. Documents Controller

### 5.1 Create Controller - `src/modules/documents/documents.controller.ts`

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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

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

        const allowedExtensions = ['.pdf', '.txt', '.md', '.docx', '.xlsx', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs'];

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

    return {
      id: document.id,
      filename: document.originalName,
      size: document.size,
      status: document.status,
      uploadedAt: document.uploadedAt,
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
    await this.documentsService.delete(id, user.id);

    return {
      message: 'Document deleted successfully',
    };
  }
}
```

---

## 6. Documents Module

### 6.1 Update Module - `src/modules/documents/documents.module.ts`

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

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentChunk])],
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

## 7. Testing Document Upload

### 7.1 Test Upload

```bash
# Upload PDF
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"

# Upload text file
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.txt"
```

### 7.2 List Documents

```bash
curl http://localhost:3000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7.3 Get Document Details

```bash
curl http://localhost:3000/api/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7.4 Delete Document

```bash
curl -X DELETE http://localhost:3000/api/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 8. Next Steps

✅ **Step 6 Complete! You should now have:**
- File upload with Multer
- Support for PDF, DOCX, XLSX, text, and code files
- Document parsing and text extraction
- Document metadata storage
- File validation and security

**Continue to Step 7:** Embeddings & Vectorization

---

## Quick Commands Reference

```bash
# Upload document
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@document.pdf"

# List documents
curl http://localhost:3000/api/documents \
  -H "Authorization: Bearer TOKEN"

# Get document
curl http://localhost:3000/api/documents/DOC_ID \
  -H "Authorization: Bearer TOKEN"

# Delete document
curl -X DELETE http://localhost:3000/api/documents/DOC_ID \
  -H "Authorization: Bearer TOKEN"
```
