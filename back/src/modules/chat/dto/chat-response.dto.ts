import { MessageRole } from '../entities/message.entity';

export class MessageResponseDto {
  id: string;
  role: MessageRole | string;
  content: string;
  createdAt: Date;
}

export class ChatResponseDto {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount?: number;
}

export class ChatWithMessagesDto extends ChatResponseDto {
  messages: MessageResponseDto[];
}
