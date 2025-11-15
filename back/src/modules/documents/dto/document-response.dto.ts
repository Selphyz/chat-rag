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
  chunkCount?: number;
}
