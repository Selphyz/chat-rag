import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiServiceUnavailableResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { QdrantService } from './qdrant.service';

const TEST_VECTOR_DIMENSION = 768;

class InsertTestVectorDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

class SearchTestDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

@ApiTags('Qdrant')
@ApiBearerAuth('access-token')
@Controller('qdrant')
export class QdrantController {
  constructor(private readonly qdrantService: QdrantService) {}

  @Post('test-insert')
  @ApiOperation({
    summary: 'Insert a test vector into Qdrant',
    description:
      'Inserts a test vector with a random embedding into the Qdrant collection. Useful for testing the vector database functionality. The vector will be created with the specified text and optional metadata.',
  })
  @ApiCreatedResponse({
    description: 'Vector inserted successfully',
    schema: {
      example: {
        message: 'Vector inserted successfully',
        id: 'test-1731587400000',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input - text is required',
  })
  @ApiServiceUnavailableResponse({
    description: 'Qdrant service is unavailable',
  })
  async testInsert(@Body() dto: InsertTestVectorDto) {
    const point = {
      id: `test-${Date.now()}`,
      vector: this.generateRandomVector(),
      payload: {
        text: dto.text,
        ...(dto.metadata ?? {}),
      },
    };

    await this.qdrantService.insertVector(point);

    return {
      message: 'Vector inserted successfully',
      id: point.id,
    };
  }

  @Post('test-search')
  @ApiOperation({
    summary: 'Search Qdrant collection with test vector',
    description:
      'Performs a semantic search in the Qdrant collection using a random test embedding. Returns the most similar vectors based on cosine distance. Useful for testing vector search functionality.',
  })
  @ApiOkResponse({
    description: 'Search completed successfully',
    schema: {
      example: {
        query: 'test query',
        results: [
          {
            id: 'doc-123-chunk-0',
            score: 0.892,
            payload: {
              text: 'Similar content from document...',
              documentId: 'doc-123',
            },
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid search parameters',
  })
  @ApiServiceUnavailableResponse({
    description: 'Qdrant service is unavailable',
  })
  async testSearch(@Body() dto: SearchTestDto) {
    const results = await this.qdrantService.search(
      this.generateRandomVector(),
      dto.limit ?? 5,
    );

    return {
      query: dto.query,
      results,
    };
  }

  @Get('info')
  @ApiOperation({
    summary: 'Get Qdrant collection information',
    description:
      'Retrieves metadata and statistics about the Qdrant collection including vector count, status, and configuration. Shows the current state of the vector database.',
  })
  @ApiOkResponse({
    description: 'Collection information retrieved successfully',
    schema: {
      example: {
        collection: 'documents_collection',
        vectorCount: 1250,
        info: {
          status: 'green',
          vectors_count: 1250,
          indexed_vectors_count: 1250,
          points_count: 1250,
          segments_count: 3,
          config: {
            params: {
              vectors: {
                size: 768,
                distance: 'Cosine',
              },
            },
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Qdrant service is unavailable',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error retrieving collection information',
  })
  async getInfo() {
    const info = await this.qdrantService.getCollectionInfo();
    const count = await this.qdrantService.countVectors();

    return {
      collection: this.qdrantService.getCollectionName(),
      vectorCount: count,
      info,
    };
  }

  @Delete('test/:id')
  @ApiOperation({
    summary: 'Delete a test vector from Qdrant',
    description:
      'Deletes a vector by its ID from the Qdrant collection. Useful for cleaning up test data.',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the vector to delete',
    example: 'test-1731587400000',
  })
  @ApiOkResponse({
    description: 'Vector deleted successfully',
    schema: {
      example: {
        message: 'Vector deleted successfully',
        id: 'test-1731587400000',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Qdrant service is unavailable',
  })
  async testDelete(@Param('id') id: string) {
    await this.qdrantService.deleteVector(id);

    return {
      message: 'Vector deleted successfully',
      id,
    };
  }

  private generateRandomVector(): number[] {
    return Array.from({ length: TEST_VECTOR_DIMENSION }, () => Math.random());
  }
}
