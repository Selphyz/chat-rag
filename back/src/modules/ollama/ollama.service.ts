import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama } from 'ollama';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollama: Ollama;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('ollama.host');
    this.model = this.configService.getOrThrow<string>('ollama.model');
    this.embeddingModel = this.configService.getOrThrow<string>(
      'ollama.embeddingModel',
    );

    this.ollama = new Ollama({ host });
    this.logger.log(`Ollama service initialized with host: ${host}`);
  }

  /**
   * Generate a chat completion using the configured model.
   */
  async chat(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<string> {
    try {
      this.logger.debug(
        `Generating chat completion with ${messages.length} messages`,
      );

      const response = await this.ollama.chat({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 0.9,
          num_predict: options?.maxTokens ?? 2000,
        },
      });

      return response.message.content;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Chat completion error: ${message}`, stack);
      throw new HttpException(
        'Failed to generate chat response',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Generate a chat completion with streaming support.
   */
  async *chatStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string> {
    try {
      const response = await this.ollama.chat({
        model: this.model,
        messages,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 0.9,
          num_predict: options?.maxTokens ?? 2000,
        },
      });

      for await (const part of response) {
        if (part.message?.content) {
          yield part.message.content;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Chat stream error: ${message}`, stack);
      throw new HttpException(
        'Failed to stream chat response',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Generate a single embedding vector.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      this.logger.debug(
        `Generating embedding for text of length ${text.length}`,
      );

      const response = await this.ollama.embeddings({
        model: this.embeddingModel,
        prompt: text,
      });

      return response.embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Embedding generation error: ${message}`, stack);
      throw new HttpException(
        'Failed to generate embedding',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Generate embeddings for multiple texts in parallel.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      this.logger.debug(`Generating embeddings for ${texts.length} texts`);

      const embeddings = await Promise.all(
        texts.map((text) => this.generateEmbedding(text)),
      );

      return embeddings;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Batch embedding error: ${message}`, stack);
      throw new HttpException(
        'Failed to generate embeddings',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Check whether Ollama is reachable and required models are available.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const models = await this.ollama.list();
      const hasChatModel = models.models.some((m) => m.name.includes(this.model));
      const hasEmbeddingModel = models.models.some((m) =>
        m.name.includes(this.embeddingModel),
      );

      if (!hasChatModel) {
        this.logger.warn(`Chat model ${this.model} not found`);
        return false;
      }

      if (!hasEmbeddingModel) {
        this.logger.warn(`Embedding model ${this.embeddingModel} not found`);
        return false;
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Health check failed: ${message}`);
      return false;
    }
  }

  /**
   * List every model that Ollama currently has pulled.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.ollama.list();
      return response.models.map((model) => model.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`List models error: ${message}`, stack);
      throw new HttpException(
        'Failed to list models',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Pull a model proactively.
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      this.logger.log(`Pulling model: ${modelName}`);
      await this.ollama.pull({ model: modelName, stream: false });
      this.logger.log(`Model ${modelName} pulled successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Pull model error: ${message}`, stack);
      throw new HttpException(
        'Failed to pull model',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  getModel(): string {
    return this.model;
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }
}
