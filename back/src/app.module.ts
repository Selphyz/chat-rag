import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
          logging: configService.get('nodeEnv') === 'development',
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    ChatModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
