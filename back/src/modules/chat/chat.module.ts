import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { OllamaModule } from '../ollama/ollama.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message]),
    OllamaModule,
    EmbeddingsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
