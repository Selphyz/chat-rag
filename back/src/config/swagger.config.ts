import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

const buildConfig = () =>
  new DocumentBuilder()
    .setTitle('Chat RAG Backend API')
    .setDescription(
      'A Retrieval-Augmented Generation (RAG) chat application backend with document processing and vector search capabilities. ' +
      'This API provides endpoints for user authentication, document management, chat sessions with AI-powered responses using Ollama, ' +
      'and vector search through Qdrant. All endpoints (except health checks and authentication) require JWT authentication.',
    )
    .setVersion('1.0.0')
    .setContact(
      'Chat RAG Support',
      'https://github.com/anthropics/chat-rag',
      'support@chat-rag.example.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer(
      'http://localhost:3000',
      'Development server',
    )
    .addServer(
      'https://api.example.com',
      'Production server',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'User authentication and authorization - Register, login, and manage user profiles')
    .addTag(
      'Chat',
      'Chat session and message management - Create chats, send messages, and interact with the RAG system',
    )
    .addTag(
      'Documents',
      'Document upload and processing - Upload documents, manage knowledge base, and track processing status',
    )
    .addTag(
      'Health',
      'Health check endpoints - Monitor application and service dependencies (Database, Ollama, Qdrant)',
    )
    .addTag(
      'Ollama',
      'Ollama LLM integration - Test chat and embedding models, list available models',
    )
    .addTag(
      'Qdrant',
      'Qdrant vector database diagnostics - Test vector operations and view collection statistics',
    )
    .build();

export const createSwaggerDocument = (app: INestApplication) => {
  const document = SwaggerModule.createDocument(app, buildConfig());
  // Update to OpenAPI 3.1.0 for better compatibility and features
  (document as any).openapi = '3.1.0';
  return document;
};