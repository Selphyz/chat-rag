import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';
import { XlsxParser } from './parsers/xlsx.parser';
import { TextParser } from './parsers/text.parser';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentChunk])],
  controllers: [DocumentsController],
  providers: [DocumentsService, PdfParser, DocxParser, XlsxParser, TextParser],
  exports: [DocumentsService],
})
export class DocumentsModule {}
