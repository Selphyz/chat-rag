import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

const buildConfig = () =>
  new DocumentBuilder()
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

export const createSwaggerDocument = (app: INestApplication) => {
  return SwaggerModule.createDocument(app, buildConfig());
};
