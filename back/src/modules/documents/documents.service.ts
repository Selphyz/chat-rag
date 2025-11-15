import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
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
    private readonly documentRepository: Repository<Document>,
    private readonly configService: ConfigService,
    private readonly pdfParser: PdfParser,
    private readonly docxParser: DocxParser,
    private readonly xlsxParser: XlsxParser,
    private readonly textParser: TextParser,
  ) {
    this.uploadDir =
      this.configService.get<string>('upload.uploadDir') || './uploads';
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create upload directory: ${message}`);
    }
  }

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
  ): Promise<Document> {
    try {
      this.logger.log(
        `Uploading document: ${file.originalname} for user: ${userId}`,
      );

      const timestamp = Date.now();
      const baseName = path.basename(file.originalname);
      const safeOriginalName = baseName.replace(/\s+/g, '_');
      const filename = `${timestamp}-${safeOriginalName}`;
      const filepath = path.join(this.uploadDir, filename);

      await fs.writeFile(filepath, file.buffer);

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
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Upload failed: ${message}`);
      throw new BadRequestException('Failed to upload document');
    }
  }

  async parseDocument(documentId: string): Promise<string> {
    const document = await this.findById(documentId);
    const filepath = path.join(this.uploadDir, document.filename);
    const buffer = await fs.readFile(filepath);

    try {
      const mimeType = document.mimeType.toLowerCase();
      const originalName = document.originalName.toLowerCase();
      let text: string;

      if (mimeType.includes('pdf') || originalName.endsWith('.pdf')) {
        text = await this.pdfParser.parse(buffer);
      } else if (
        mimeType.includes('wordprocessingml') ||
        originalName.endsWith('.docx')
      ) {
        text = await this.docxParser.parse(buffer);
      } else if (
        mimeType.includes('spreadsheetml') ||
        originalName.endsWith('.xlsx')
      ) {
        text = await this.xlsxParser.parse(buffer);
      } else {
        text = await this.textParser.parse(buffer);
      }

      this.logger.log(
        `Parsed document ${documentId}: ${text.length} characters extracted`,
      );

      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Parsing failed for ${documentId}: ${message}`);
      await this.updateStatus(documentId, DocumentStatus.FAILED, message);

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
    const updateData: Partial<Document> = { status };

    if (status === DocumentStatus.PROCESSED) {
      updateData.processedAt = new Date();
      updateData.error = null;
    } else if (status === DocumentStatus.PROCESSING) {
      updateData.processedAt = null;
      updateData.error = null;
    } else if (status === DocumentStatus.FAILED) {
      updateData.processedAt = null;
      updateData.error = error ?? 'Document processing failed';
    }

    if (error && status !== DocumentStatus.FAILED) {
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

    const filepath = path.join(this.uploadDir, document.filename);

    try {
      await fs.unlink(filepath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to delete file ${filepath}. Proceeding with DB cleanup. Error: ${message}`,
      );
    }

    await this.documentRepository.delete(id);
    this.logger.log(`Document ${id} deleted for user ${userId}`);
  }

  async getUserDocumentCount(userId: string): Promise<number> {
    return this.documentRepository.count({ where: { userId } });
  }
}
