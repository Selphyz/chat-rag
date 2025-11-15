import {
  BadRequestException,
  Controller,
  Delete,
  forwardRef,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { DocumentResponseDto } from './dto/document-response.dto';
import { Document } from './entities/document.entity';
import { EmbeddingsService } from '../embeddings/embeddings.service';

const MAX_FILE_SIZE = parseInt(
  process.env.MAX_FILE_SIZE || '10485760',
  10,
);

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documentsService: DocumentsService,
    @Inject(forwardRef(() => EmbeddingsService))
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE,
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

        const fileName = file.originalname.toLowerCase();
        const isAllowedMime = allowedMimes.includes(file.mimetype);
        const isAllowedExtension = allowedExtensions.some((ext) =>
          fileName.endsWith(ext),
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
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const document = await this.documentsService.uploadDocument(
      file,
      user.id,
    );

    this.embeddingsService
      .processDocument(document.id)
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Background processing failed for ${document.id}: ${message}`,
        );
      });

    return {
      ...this.mapDocumentResponse(document),
      message: 'Document uploaded and processing started',
    };
  }

  @Get()
  async listDocuments(
    @CurrentUser() user: User,
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documentsService.findAll(user.id);
    return documents.map((doc) => this.mapDocumentResponse(doc));
  }

  @Get(':id')
  async getDocument(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentsService.findById(id);

    if (document.userId !== user.id) {
      throw new BadRequestException('Access denied');
    }

    return this.mapDocumentResponse(document);
  }

  @Delete(':id')
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    const document = await this.documentsService.findById(id);

    if (document.userId !== user.id) {
      throw new BadRequestException('Access denied');
    }

    await this.embeddingsService.deleteDocumentEmbeddings(id);
    await this.documentsService.delete(id, user.id);

    return { message: 'Document and embeddings deleted successfully' };
  }

  @Post(':id/reprocess')
  async reprocessDocument(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    const document = await this.documentsService.findById(id);

    if (document.userId !== user.id) {
      throw new BadRequestException('Access denied');
    }

    await this.embeddingsService.deleteDocumentEmbeddings(id);
    this.embeddingsService.processDocument(id).catch((error) => {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Reprocessing failed for ${id}: ${message}`,
      );
    });

    return { message: 'Document reprocessing started' };
  }

  private mapDocumentResponse(document: Document): DocumentResponseDto {
    return {
      id: document.id,
      filename: document.filename,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: document.status,
      uploadedAt: document.uploadedAt,
      processedAt: document.processedAt,
      error: document.error,
      chunkCount: document.chunks?.length ?? undefined,
    };
  }
}
