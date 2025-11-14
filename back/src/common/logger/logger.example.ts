/**
 * LOGGER SERVICE USAGE EXAMPLES
 *
 * This file demonstrates how to use the LoggerService throughout the application.
 * Delete this file in production - it's for development reference only.
 */

import { Injectable } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Injectable()
export class LoggerExampleService {
  constructor(private logger: LoggerService) {}

  exampleBasicLogging() {
    // Simple log message
    this.logger.log('Application started', 'ExampleService');

    // Debug message (only shown in development)
    this.logger.debug(
      'Detailed debug information',
      'ExampleService',
    );

    // Info message
    this.logger.info(
      'User registered successfully',
      'AuthService',
    );

    // Warning message
    this.logger.warn(
      'Database connection is slow',
      'DatabaseService',
    );

    // Error message
    this.logger.error(
      'Failed to process document',
      'DocumentService',
      new Error('Invalid PDF format'),
    );
  }

  exampleLoggingWithContext() {
    // Log with additional context data
    this.logger.info(
      'User login',
      'AuthService',
      {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
      },
    );

    // Debug with context
    this.logger.debug(
      'Query executed',
      'DatabaseService',
      {
        query: 'SELECT * FROM users WHERE id = $1',
        duration: 23,
        affectedRows: 1,
      },
    );

    // Warning with context
    this.logger.warn(
      'High memory usage detected',
      'MonitorService',
      {
        memoryUsage: 87,
        threshold: 80,
        process: 'node',
      },
    );
  }

  exampleErrorHandling() {
    try {
      // Simulated operation
      throw new Error('Database connection failed');
    } catch (error) {
      // Log error with full stack trace
      this.logger.error(
        'Database operation failed',
        'ChatService',
        error,
        {
          operation: 'fetchMessages',
          chatId: 'abc-123',
          retryCount: 2,
        },
      );
    }
  }

  exampleRagPipelineLogging() {
    // Document processing pipeline
    const documentId = 'doc-123';
    const userId = 'user-456';

    this.logger.info(
      'Starting document processing',
      'DocumentProcessorService',
      {
        documentId,
        userId,
        filename: 'research.pdf',
        fileSize: 2048576,
      },
    );

    // Chunking operation
    this.logger.debug(
      'Splitting document into chunks',
      'EmbeddingsService',
      {
        documentId,
        chunkSize: 1000,
        chunkOverlap: 200,
        totalChunks: 42,
      },
    );

    // Embedding operation
    this.logger.info(
      'Generating embeddings',
      'EmbeddingsService',
      {
        documentId,
        chunksCount: 42,
        model: 'nomic-embed-text',
        dimension: 768,
      },
    );

    // Vector storage
    this.logger.debug(
      'Storing vectors in Qdrant',
      'QdrantService',
      {
        documentId,
        vectorCount: 42,
        collection: 'documents_collection',
      },
    );

    // Completion
    this.logger.info(
      'Document processing completed',
      'DocumentProcessorService',
      {
        documentId,
        userId,
        duration: 5234, // milliseconds
        status: 'processed',
      },
    );
  }

  exampleChatRagLogging() {
    const chatId = 'chat-789';
    const userId = 'user-456';
    const userMessage = 'What is RAG?';

    // User message received
    this.logger.info(
      'Message received from user',
      'ChatService',
      {
        chatId,
        userId,
        messageLength: userMessage.length,
      },
    );

    // Embedding user query
    this.logger.debug(
      'Embedding user query',
      'EmbeddingsService',
      {
        chatId,
        messageLength: userMessage.length,
      },
    );

    // Vector search
    this.logger.debug(
      'Searching relevant chunks',
      'QdrantService',
      {
        chatId,
        userId,
        topK: 5,
        collectionName: 'documents_collection',
      },
    );

    // Context retrieved
    this.logger.info(
      'Retrieved context for chat',
      'ChatService',
      {
        chatId,
        userId,
        chunksFound: 5,
        totalContextLength: 3500,
        documents: ['doc-1', 'doc-2', 'doc-3'],
      },
    );

    // LLM call
    this.logger.debug(
      'Sending prompt to Ollama',
      'OllamaService',
      {
        model: 'llama3.2',
        maxTokens: 2048,
        temperature: 0.7,
        contextChunks: 5,
      },
    );

    // Response generated
    this.logger.info(
      'AI response generated',
      'ChatService',
      {
        chatId,
        userId,
        responseLength: 450,
        duration: 3200, // milliseconds
      },
    );
  }
}

/**
 * LOG LEVEL GUIDELINES:
 *
 * LOG (Cyan):
 * - General application messages
 * - State transitions
 * - Entry/exit points
 * Example: 'Service initialized', 'Module loaded'
 *
 * DEBUG (Magenta, dev only):
 * - Detailed execution flow
 * - Variable values
 * - Query details
 * Use this for debugging without polluting production logs
 * Example: 'Query executed with 234ms', 'Cache hit for key: xyz'
 *
 * INFO (Green):
 * - Important events
 * - Business logic milestones
 * - User actions
 * Example: 'User registered', 'Document processing started'
 *
 * WARN (Yellow):
 * - Potentially problematic situations
 * - Recoverable errors
 * - Deprecation notices
 * Example: 'Slow query detected', 'Retry attempt 3/5'
 *
 * ERROR (Red):
 * - Failures that need attention
 * - Exceptions
 * - Failed operations
 * Example: 'Database connection failed', 'Invalid file format'
 *
 * FATAL (Red background):
 * - Critical failures
 * - Application-stopping errors
 * Example: 'Service crashed', 'Configuration invalid'
 */
