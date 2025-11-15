import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  const logger = app.get(LoggerService);
  logger.info(`🚀 Starting application on port ${port}`, 'Bootstrap');

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Set API prefix
  app.setGlobalPrefix('api');

  // Apply global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Chat RAG Backend API')
    .setDescription(
      'A Retrieval-Augmented Generation (RAG) chat application backend with document processing and vector search capabilities',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'User authentication and authorization')
    .addTag('Chat', 'Chat session and message management')
    .addTag('Documents', 'Document upload and processing')
    .addTag('Health', 'Health check endpoints')
    .addTag('Qdrant', 'Qdrant vector diagnostics and utilities')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: false,
    },
  });

  logger.info(`📚 Swagger documentation available at http://localhost:${port}/api/docs`, 'Bootstrap');

  await app.listen(port);
  logger.info(`✅ Application is running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
