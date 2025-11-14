import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { DocumentChunk } from './document-chunk.entity';

export enum DocumentStatus {
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  filename: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column('bigint')
  size: number;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PROCESSING,
  })
  status: DocumentStatus;

  @Column('text', { nullable: true })
  error: string;

  @OneToMany(() => DocumentChunk, (chunk) => chunk.document, { cascade: true })
  chunks: DocumentChunk[];

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
