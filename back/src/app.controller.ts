import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller()
@ApiTags('Health')
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Get general health status',
    description:
      'Returns the overall health status of the application including database connectivity',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2025-11-14T23:30:00.000Z',
        uptime: 125.5,
        database: {
          connected: true,
          type: 'postgres',
        },
      },
    },
  })
  async healthCheck() {
    const isDbConnected = this.dataSource.isInitialized;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: isDbConnected,
        type: this.dataSource.options.type,
      },
    };
  }

  @Public()
  @Get('health/db')
  @ApiOperation({
    summary: 'Check database connectivity',
    description: 'Performs a test query to verify database connection is working',
  })
  @ApiResponse({
    status: 200,
    description: 'Database is connected',
    schema: {
      example: {
        status: 'ok',
        database: 'connected',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Database connection failed',
    schema: {
      example: {
        status: 'error',
        database: 'disconnected',
        error: 'Connection timeout',
      },
    },
  })
  async databaseHealth() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      };
    }
  }
}
