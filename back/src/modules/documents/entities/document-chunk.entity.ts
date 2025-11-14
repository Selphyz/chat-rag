import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => Document, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'chunk_index' })
  chunkIndex: number;

  @Column('text')
  content: string;

  @Column({ name: 'vector_id' })
  vectorId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
