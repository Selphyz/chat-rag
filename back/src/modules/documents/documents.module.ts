import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentChunk])],
  exports: [TypeOrmModule],
})
export class DocumentsModule {}
