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
import {
  ApiConsumes,
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
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
@ApiBearerAuth('access-token')
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
  @ApiOperation({
    summary: 'Upload a document for processing',
    description:
      'Uploads a document to be processed and added to the knowledge base. Supported formats: PDF, DOCX, XLSX, TXT, Markdown, and source code files (JS, TS, Python, Java, C++, C, Go, Rust). The document is asynchronously processed: text is extracted, split into chunks, and embeddings are generated. Processing status can be checked via the GET endpoint.',
  })
  @ApiCreatedResponse({
    description: 'Document uploaded successfully and processing started',
    type: DocumentResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'document_1731587400000.pdf',
      originalName: 'my-research.pdf',
      mimeType: 'application/pdf',
      size: 2048576,
      status: 'processing',
      uploadedAt: '2025-11-14T10:30:00.000Z',
      processedAt: null,
      error: null,
      chunkCount: null,
      message: 'Document uploaded and processing started',
    },
  })
  @ApiBadRequestResponse({
    description: 'No file provided or unsupported file type',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
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
  @ApiOperation({
    summary: 'List all uploaded documents',
    description:
      'Retrieves all documents uploaded by the authenticated user. Includes processing status and metadata for each document.',
  })
  @ApiOkResponse({
    description: 'Documents retrieved successfully',
    type: [DocumentResponseDto],
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        filename: 'document_1731587400000.pdf',
        originalName: 'research-paper.pdf',
        mimeType: 'application/pdf',
        size: 2048576,
        status: 'processed',
        uploadedAt: '2025-11-14T10:30:00.000Z',
        processedAt: '2025-11-14T10:35:00.000Z',
        error: null,
        chunkCount: 245,
      },
    ],
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  async listDocuments(
    @CurrentUser() user: User,
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documentsService.findAll(user.id);
    return documents.map((doc) => this.mapDocumentResponse(doc));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific document',
    description:
      'Retrieves metadata and processing information for a specific document. Only the document owner can access it.',
  })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the document',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Document retrieved successfully',
    type: DocumentResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'document_1731587400000.pdf',
      originalName: 'research-paper.pdf',
      mimeType: 'application/pdf',
      size: 2048576,
      status: 'processed',
      uploadedAt: '2025-11-14T10:30:00.000Z',
      processedAt: '2025-11-14T10:35:00.000Z',
      error: null,
      chunkCount: 245,
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  @ApiBadRequestResponse({
    description: 'Access denied - you do not own this document',
  })
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
  @ApiOperation({
    summary: 'Delete a document and its embeddings',
    description:
      'Permanently deletes a document and all associated vector embeddings from the knowledge base. This action cannot be undone. Only the document owner can delete it.',
  })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the document to delete',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Document and embeddings deleted successfully',
    schema: {
      example: {
        message: 'Document and embeddings deleted successfully',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  @ApiBadRequestResponse({
    description: 'Access denied - you do not own this document',
  })
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
  @ApiOperation({
    summary: 'Reprocess a document',
    description:
      'Reprocesses a document: existing embeddings are deleted and the document is re-parsed, re-chunked, and re-embedded. Useful if processing failed initially or if chunking parameters have changed. Processing happens asynchronously in the background.',
  })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the document to reprocess',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Document reprocessing started',
    schema: {
      example: {
        message: 'Document reprocessing started',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  @ApiBadRequestResponse({
    description: 'Access denied - you do not own this document',
  })
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
