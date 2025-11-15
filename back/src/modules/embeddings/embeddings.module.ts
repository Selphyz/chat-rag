import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentChunk } from '../documents/entities/document-chunk.entity';
import { OllamaModule } from '../ollama/ollama.module';
import { QdrantModule } from '../qdrant/qdrant.module';
import { EmbeddingsService } from './embeddings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentChunk]),
    OllamaModule,
    QdrantModule,
    forwardRef(() => DocumentsModule),
  ],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
