import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Insert a random test vector into Qdrant' })
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
  @ApiOperation({ summary: 'Search for vectors using a random test embedding' })
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
  @ApiOperation({ summary: 'Fetch Qdrant collection information' })
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
  @ApiOperation({ summary: 'Delete a vector by ID from Qdrant' })
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
