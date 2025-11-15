import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DocumentInterface } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Repository } from 'typeorm';
import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';
import { DocumentChunk } from '../documents/entities/document-chunk.entity';
import { OllamaService } from '../ollama/ollama.service';
import {
  QdrantService,
  VectorPoint,
} from '../qdrant/qdrant.service';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly defaultTopK: number;
  private readonly textSplitter: RecursiveCharacterTextSplitter;

  constructor(
    @InjectRepository(DocumentChunk)
    private readonly chunkRepository: Repository<DocumentChunk>,
    private readonly configService: ConfigService,
    private readonly ollamaService: OllamaService,
    private readonly qdrantService: QdrantService,
    @Inject(forwardRef(() => DocumentsService))
    private readonly documentsService: DocumentsService,
  ) {
    this.chunkSize =
      this.configService.get<number>('chunking.chunkSize') ?? 1000;
    this.chunkOverlap =
      this.configService.get<number>('chunking.chunkOverlap') ?? 200;
    this.defaultTopK =
      this.configService.get<number>('chunking.retrievalTopK') ?? 5;

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
  }

  /**
   * Process a document end-to-end: chunking, embedding, and persistence.
   */
  async processDocument(documentId: string): Promise<void> {
    try {
      this.logger.log(`Processing document: ${documentId}`);
      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.PROCESSING,
      );

      const text = await this.documentsService.parseDocument(documentId);
      const chunks = await this.chunkText(text);
      this.logger.log(`Created ${chunks.length} chunks for ${documentId}`);

      if (chunks.length === 0) {
        this.logger.warn(`Document ${documentId} produced no chunks`);
        await this.documentsService.updateStatus(
          documentId,
          DocumentStatus.FAILED,
          'Document did not produce any content for embeddings',
        );
        return;
      }

      const embeddings = await this.generateEmbeddings(
        chunks.map((chunk) => chunk.pageContent),
      );
      this.logger.log(`Generated ${embeddings.length} embeddings`);

      await this.storeChunksAndVectors(documentId, chunks, embeddings);
      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.PROCESSED,
      );
      this.logger.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown processing error';
      this.logger.error(
        `Failed to process document ${documentId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.FAILED,
        message,
      );

      throw error;
    }
  }

  /**
   * Split text into overlapping chunks using LangChain utilities.
   */
  private async chunkText(text: string): Promise<DocumentInterface[]> {
    return this.textSplitter.createDocuments([text]);
  }

  /**
   * Generate embeddings for each chunk via Ollama.
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.ollamaService.generateEmbeddings(texts);
  }

  /**
   * Persist chunk metadata and store vectors in Qdrant.
   */
  private async storeChunksAndVectors(
    documentId: string,
    chunks: DocumentInterface[],
    embeddings: number[][],
  ): Promise<void> {
    const document = await this.documentsService.findById(documentId);

    if (embeddings.length !== chunks.length) {
      throw new Error('Embeddings count does not match chunk count');
    }

    const vectorPoints: VectorPoint[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const vectorId = `${documentId}-chunk-${i}`;

      const chunkEntity = this.chunkRepository.create({
        documentId,
        chunkIndex: i,
        content: chunks[i].pageContent,
        vectorId,
      });

      const savedChunk = await this.chunkRepository.save(chunkEntity);

      vectorPoints.push({
        id: vectorId,
        vector: embeddings[i],
        payload: {
          chunkId: savedChunk.id,
          documentId,
          userId: document.userId,
          content: chunks[i].pageContent,
          metadata: {
            filename: document.originalName,
            chunkIndex: i,
          },
        },
      });
    }

    await this.qdrantService.insertVectors(vectorPoints);
    this.logger.log(
      `Stored ${chunks.length} chunks and vectors for document ${documentId}`,
    );
  }

  /**
   * Retrieve relevant chunks for a query scoped by user ownership.
   */
  async searchRelevantChunks(
    query: string,
    userId: string,
    limit?: number,
  ): Promise<Array<{ content: string; score: number; metadata: any }>> {
    const topK = limit ?? this.defaultTopK;
    const queryEmbedding = await this.ollamaService.generateEmbedding(query);
    const results = await this.qdrantService.searchByUser(
      queryEmbedding,
      userId,
      topK,
    );

    return results.map((result) => ({
      content: result.payload.content,
      score: result.score,
      metadata: result.payload.metadata,
    }));
  }

  /**
   * Remove embeddings for a specific document from both databases.
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    await this.qdrantService.deleteDocumentVectors(documentId);
    await this.chunkRepository.delete({ documentId });
    this.logger.log(`Deleted embeddings for document ${documentId}`);
  }
}
