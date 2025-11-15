import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerService } from './common/logger/logger.service';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { OllamaModule } from './modules/ollama/ollama.module';
import { QdrantModule } from './modules/qdrant/qdrant.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        let host = configService.get('database.host');
        // If running outside Docker and host is 'postgres', use localhost
        if (host === 'postgres' && process.env.NODE_ENV !== 'production') {
          host = 'localhost';
        }
        return {
          type: 'postgres',
          host,
          port: configService.get('database.port'),
          username: configService.get('database.user'),
          password: configService.get('database.password'),
          database: configService.get('database.name'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('nodeEnv') === 'development',
          logging: false,
          retryAttempts: 10,
          retryDelay: 3000,
          connectTimeoutMS: 10000,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    ChatModule,
    DocumentsModule,
    OllamaModule,
    QdrantModule,
    EmbeddingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(HttpLoggerMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
