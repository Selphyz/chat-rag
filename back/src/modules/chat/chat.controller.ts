import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatResponseDto,
  ChatWithMessagesDto,
  MessageResponseDto,
} from './dto/chat-response.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new chat session',
    description:
      'Creates a new chat session for the authenticated user. Chat sessions are used to organize conversations with the AI assistant and maintain message history.',
  })
  @ApiCreatedResponse({
    description: 'Chat session created successfully',
    type: ChatResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Project Discussion',
      createdAt: '2025-11-14T10:30:00.000Z',
      updatedAt: '2025-11-14T10:30:00.000Z',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input - title is required',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
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
  @ApiOperation({
    summary: 'List all chat sessions',
    description:
      'Retrieves all chat sessions for the authenticated user, including message counts. Returns an empty array if no chats exist.',
  })
  @ApiOkResponse({
    description: 'Chat sessions retrieved successfully',
    type: [ChatResponseDto],
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Project Discussion',
        createdAt: '2025-11-14T10:30:00.000Z',
        updatedAt: '2025-11-14T10:30:00.000Z',
        messageCount: 5,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Learning Queries',
        createdAt: '2025-11-14T09:15:00.000Z',
        updatedAt: '2025-11-14T09:15:00.000Z',
        messageCount: 12,
      },
    ],
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
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
  @ApiOperation({
    summary: 'Get a specific chat session with all messages',
    description:
      'Retrieves a specific chat session including all messages in the conversation history. Messages are ordered chronologically. Only the owner of the chat can access it.',
  })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the chat session',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Chat session with messages retrieved successfully',
    type: ChatWithMessagesDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Project Discussion',
      createdAt: '2025-11-14T10:30:00.000Z',
      updatedAt: '2025-11-14T10:35:00.000Z',
      messages: [
        {
          id: '550e8400-e29b-41d4-a716-446655440100',
          role: 'user',
          content: 'What are the best practices for document chunking?',
          createdAt: '2025-11-14T10:31:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440101',
          role: 'assistant',
          content:
            'Document chunking is important for RAG systems. Here are best practices...',
          createdAt: '2025-11-14T10:31:05.000Z',
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Chat session not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  @ApiBadRequestResponse({
    description: 'Access denied - you do not own this chat session',
  })
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
  @ApiOperation({
    summary: 'Delete a chat session',
    description:
      'Permanently deletes a chat session and all associated messages. This action cannot be undone. Only the owner of the chat can delete it.',
  })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the chat session to delete',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Chat session deleted successfully',
    schema: {
      example: {
        message: 'Chat deleted successfully',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Chat session not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  @ApiBadRequestResponse({
    description: 'Access denied - you do not own this chat session',
  })
  async deleteChat(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.chatService.deleteChat(id, user.id);
    return { message: 'Chat deleted successfully' };
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Send a message to a chat session',
    description:
      'Sends a message to a chat session. The message is processed through the RAG pipeline: relevant document chunks are retrieved, context is built, and the AI assistant generates a response. Both user and assistant messages are saved to the chat history.',
  })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the chat session',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiCreatedResponse({
    description: 'Message sent and AI response generated successfully',
    schema: {
      example: {
        userMessage: {
          id: '550e8400-e29b-41d4-a716-446655440100',
          role: 'user',
          content: 'Based on my documents, what is the main topic?',
          createdAt: '2025-11-14T10:31:00.000Z',
        },
        assistantMessage: {
          id: '550e8400-e29b-41d4-a716-446655440101',
          role: 'assistant',
          content:
            'Based on the documents you uploaded, the main topic appears to be...',
          createdAt: '2025-11-14T10:31:05.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Chat session not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  @ApiBadRequestResponse({
    description: 'Invalid message or access denied',
  })
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
