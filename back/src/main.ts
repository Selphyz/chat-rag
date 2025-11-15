import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import {
  SWAGGER_PATH,
  createSwaggerDocument,
} from './config/swagger.config';

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
  const document = createSwaggerDocument(app);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: false,
    },
  });

  logger.info(
    `📚 Swagger documentation available at http://localhost:${port}/${SWAGGER_PATH}`,
    'Bootstrap',
  );

  await app.listen(port);
  logger.info(`✅ Application is running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
