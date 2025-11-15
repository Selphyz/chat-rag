import { Controller, Post, Body, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiInternalServerErrorResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OllamaService, ChatMessage } from './ollama.service';

class TestChatDto {
  @ApiProperty({
    description:
      'Message that will be sent to the Ollama chat model. Will be processed as a user message.',
    example: 'What is Retrieval Augmented Generation?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

@ApiTags('Ollama')
@ApiBearerAuth('access-token')
@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Post('test-chat')
  @ApiOperation({
    summary: 'Test chat completion with Ollama',
    description:
      'Sends a test message to the configured Ollama LLM and returns the generated response. Useful for testing the Ollama service connectivity and model functionality.',
  })
  @ApiCreatedResponse({
    description: 'Chat completion generated successfully',
    schema: {
      example: {
        request: 'What is Retrieval Augmented Generation?',
        response:
          'Retrieval Augmented Generation (RAG) is a technique that combines... [full response from LLM]',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Ollama service is unavailable or model not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error generating response from Ollama',
  })
  async testChat(@Body() dto: TestChatDto) {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: dto.message,
      },
    ];

    const response = await this.ollamaService.chat(messages);

    return {
      request: dto.message,
      response,
    };
  }

  @Post('test-embedding')
  @ApiOperation({
    summary: 'Generate test embedding with Ollama',
    description:
      'Generates a vector embedding for a piece of text using the configured Ollama embedding model. Returns the full embedding vector and its dimension. Useful for testing the embedding service and understanding vector dimensionality.',
  })
  @ApiCreatedResponse({
    description: 'Embedding generated successfully',
    schema: {
      example: {
        text: 'This is a test document for embedding',
        embeddingDimension: 768,
        embedding: [0.12, -0.02, 0.93, 0.45, -0.23, 0.11, 0.89, 0.02, -0.45, 0.67],
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Ollama service is unavailable or embedding model not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error generating embedding from Ollama',
  })
  async testEmbedding(@Body() dto: TestChatDto) {
    const embedding = await this.ollamaService.generateEmbedding(dto.message);

    return {
      text: dto.message,
      embeddingDimension: embedding.length,
      embedding: embedding.slice(0, 10),
    };
  }

  @Get('models')
  @ApiOperation({
    summary: 'List available Ollama models',
    description:
      'Retrieves all models that are currently pulled and available in the Ollama instance. Shows which model is configured for chat and which for embeddings.',
  })
  @ApiOkResponse({
    description: 'Available models retrieved successfully',
    schema: {
      example: {
        models: ['llama3.2:latest', 'nomic-embed-text:latest'],
        currentModel: 'llama3.2',
        embeddingModel: 'nomic-embed-text',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Ollama service is unavailable',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error retrieving models from Ollama',
  })
  async listModels() {
    const models = await this.ollamaService.listModels();

    return {
      models,
      currentModel: this.ollamaService.getModel(),
      embeddingModel: this.ollamaService.getEmbeddingModel(),
    };
  }
}
