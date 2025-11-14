import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  const logger = app.get(LoggerService);
  logger.info(`🚀 Starting application on port ${port}`, 'Bootstrap');

  await app.listen(port);
  logger.info(`✅ Application is running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
