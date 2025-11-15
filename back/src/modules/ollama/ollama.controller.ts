import { Controller, Post, Body, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OllamaService, ChatMessage } from './ollama.service';

class TestChatDto {
  @ApiProperty({
    description: 'Message that will be sent to the Ollama chat model',
    example: 'What is Retrieval Augmented Generation?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

@ApiTags('Ollama')
@ApiBearerAuth()
@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Post('test-chat')
  @ApiOperation({
    summary: 'Send a test chat message to the configured Ollama model',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the LLM response for the provided prompt',
    schema: {
      example: {
        request: 'Hello!',
        response: 'Hello! How can I assist you today?',
      },
    },
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
    summary: 'Generate an embedding for a sample piece of text',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns information about the generated embedding',
    schema: {
      example: {
        text: 'This is a test document for embedding',
        embeddingDimension: 768,
        embedding: [0.12, -0.02, 0.93],
      },
    },
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
    summary: 'List all models currently pulled in Ollama',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns model metadata from Ollama',
    schema: {
      example: {
        models: ['llama3.2', 'nomic-embed-text'],
        currentModel: 'llama3.2',
        embeddingModel: 'nomic-embed-text',
      },
    },
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
