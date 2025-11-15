import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatResponseDto,
  ChatWithMessagesDto,
} from './dto/chat-response.dto';

@ApiTags('Chat')
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async createChat(
    @Body() dto: CreateChatDto,
    @CurrentUser() user: User,
  ): Promise<ChatResponseDto> {
    const chat = await this.chatService.createChat(user.id, dto.title);

    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }

  @Get()
  async listChats(
    @CurrentUser() user: User,
  ): Promise<ChatResponseDto[]> {
    const chats = await this.chatService.getUserChats(user.id);

    return Promise.all(
      chats.map(async (chat) => ({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: await this.chatService.getMessageCount(chat.id),
      })),
    );
  }

  @Get(':id')
  async getChat(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ChatWithMessagesDto> {
    const chat = await this.chatService.getChatById(id, user.id);

    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages: (chat.messages ?? []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  }

  @Delete(':id')
  async deleteChat(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.chatService.deleteChat(id, user.id);
    return { message: 'Chat deleted successfully' };
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ): Promise<{
    userMessage: {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
    };
    assistantMessage: {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
    };
  }> {
    const { userMessage, assistantMessage } =
      await this.chatService.sendMessage(id, user.id, dto.message);

    return {
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    };
  }
}
