import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Document, DocumentStatus } from './entities/document.entity';
import { DocumentsService } from './documents.service';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';
import { XlsxParser } from './parsers/xlsx.parser';
import { TextParser } from './parsers/text.parser';
import { createMockRepository } from '../../test/test-utils';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

type MockFile = Express.Multer.File;

describe('DocumentsService', () => {
  let service: DocumentsService;
  const documentRepository = createMockRepository<Document>();
  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'upload.uploadDir') {
        return '/tmp/uploads';
      }
      return undefined;
    }),
  };
  const pdfParser = { parse: jest.fn() } as unknown as PdfParser;
  const docxParser = { parse: jest.fn() } as unknown as DocxParser;
  const xlsxParser = { parse: jest.fn() } as unknown as XlsxParser;
  const textParser = { parse: jest.fn() } as unknown as TextParser;

  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(
      documentRepository as any,
      configService as any,
      pdfParser,
      docxParser,
      xlsxParser,
      textParser,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uploadDocument', () => {
    const mockFile: MockFile = {
      originalname: 'Research Notes.pdf',
      buffer: Buffer.from('file-data'),
      mimetype: 'application/pdf',
      size: 1024,
      fieldname: 'file',
      encoding: 'utf8',
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('should persist file and document metadata', async () => {
      const storedDocument = {
        id: 'doc-123',
        userId: 'user-1',
        filename: '1700000000000-Research_Notes.pdf',
        originalName: mockFile.originalname,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        status: DocumentStatus.PROCESSING,
        uploadedAt: new Date(),
        processedAt: null,
        error: null,
        chunks: [],
        updatedAt: new Date(),
        user: null,
      } as unknown as Document;

      documentRepository.create.mockReturnValue(storedDocument);
      documentRepository.save.mockResolvedValue(storedDocument);

      jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

      const result = await service.uploadDocument(mockFile, 'user-1');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('/tmp/uploads', '1700000000000-Research_Notes.pdf'),
        mockFile.buffer,
      );

      expect(documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          filename: '1700000000000-Research_Notes.pdf',
          originalName: mockFile.originalname,
          mimeType: mockFile.mimetype,
          size: mockFile.size,
          status: DocumentStatus.PROCESSING,
        }),
      );
      expect(result).toBe(storedDocument);
    });

    it('should throw BadRequestException on persistence errors', async () => {
      documentRepository.create.mockReturnValue({} as Document);
      documentRepository.save.mockRejectedValue(new Error('db failure'));

      await expect(
        service.uploadDocument(mockFile, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('parseDocument', () => {
    it('should route PDFs to the pdf parser', async () => {
      const document = {
        id: 'doc-001',
        userId: 'user-1',
        filename: '1700-sample.pdf',
        originalName: 'sample.pdf',
        mimeType: 'application/pdf',
        size: 100,
        status: DocumentStatus.PROCESSING,
        uploadedAt: new Date(),
        processedAt: null,
        error: null,
        chunks: [],
        updatedAt: new Date(),
        user: null,
      } as unknown as Document;

      const fileBuffer = Buffer.from('pdf content');

      documentRepository.findOne.mockResolvedValue(document);
      mockFs.readFile.mockResolvedValue(fileBuffer);
      (pdfParser.parse as jest.Mock).mockResolvedValue('parsed pdf text');

      const result = await service.parseDocument(document.id);

      expect(pdfParser.parse).toHaveBeenCalledWith(fileBuffer);
      expect(result).toBe('parsed pdf text');
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when missing', async () => {
      documentRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should remove file and entity for matching user', async () => {
      const document = {
        id: 'doc-123',
        userId: 'user-1',
        filename: '1700-sample.pdf',
        originalName: 'sample.pdf',
        mimeType: 'application/pdf',
        size: 100,
        status: DocumentStatus.PROCESSED,
        uploadedAt: new Date(),
        processedAt: new Date(),
        error: null,
        chunks: [],
        updatedAt: new Date(),
        user: null,
      } as unknown as Document;

      documentRepository.findOne.mockResolvedValue(document);

      await service.delete(document.id, 'user-1');

      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join('/tmp/uploads', document.filename),
      );
      expect(documentRepository.delete).toHaveBeenCalledWith(document.id);
    });

    it('should throw when document is not owned by user', async () => {
      documentRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('doc-432', 'wrong-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
