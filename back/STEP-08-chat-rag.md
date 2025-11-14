# Step 8: Chat Module with RAG

**Estimated Time:** 4 hours
**Prerequisites:** Steps 1-7 completed

---

## Overview

In this step, we'll implement the chat system with RAG:
- Create chat sessions
- Send and receive messages
- Implement RAG pipeline (retrieval + generation)
- Store chat history
- Context-aware responses using user documents

---

## 1. DTOs

### 1.1 Create Chat DTO - `src/modules/chat/dto/create-chat.dto.ts`

```typescript
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;
}
```

### 1.2 Send Message DTO - `src/modules/chat/dto/send-message.dto.ts`

```typescript
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}
```

### 1.3 Chat Response DTOs - `src/modules/chat/dto/chat-response.dto.ts`

```typescript
export class MessageResponseDto {
  id: string;
  role: string;
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
```

---

## 2. Chat Service

### 2.1 Create Chat Service - `src/modules/chat/chat.service.ts`

```typescript
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './entities/chat.entity';
import { Message, MessageRole } from './entities/message.entity';
import { OllamaService, ChatMessage } from '../ollama/ollama.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly retrievalTopK: number;

  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private ollamaService: OllamaService,
    private embeddingsService: EmbeddingsService,
    private configService: ConfigService,
  ) {
    this.retrievalTopK = this.configService.get<number>('chunking.retrievalTopK');
  }

  /**
   * Create a new chat session
   */
  async createChat(userId: string, title?: string): Promise<Chat> {
    const chat = this.chatRepository.create({
      userId,
      title: title || 'New Chat',
    });

    await this.chatRepository.save(chat);

    this.logger.log(`Created chat ${chat.id} for user ${userId}`);

    return chat;
  }

  /**
   * Get all chats for a user
   */
  async getUserChats(userId: string): Promise<Chat[]> {
    return this.chatRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Get a specific chat with messages
   */
  async getChatById(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
      relations: ['messages'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  /**
   * Delete a chat
   */
  async deleteChat(chatId: string, userId: string): Promise<void> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    await this.chatRepository.delete(chatId);

    this.logger.log(`Deleted chat ${chatId}`);
  }

  /**
   * Send message and get AI response with RAG
   */
  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    // Verify chat ownership
    const chat = await this.getChatById(chatId, userId);

    // Save user message
    const userMessage = await this.saveMessage(chatId, MessageRole.USER, content);

    // Retrieve relevant context from documents
    const context = await this.retrieveContext(content, userId);

    // Get chat history
    const history = await this.getChatHistory(chatId);

    // Generate AI response with context
    const aiResponse = await this.generateResponse(content, context, history);

    // Save assistant message
    const assistantMessage = await this.saveMessage(
      chatId,
      MessageRole.ASSISTANT,
      aiResponse,
    );

    // Update chat title if it's the first message
    if (history.length === 0) {
      await this.updateChatTitle(chatId, content);
    }

    // Update chat timestamp
    await this.chatRepository.update(chatId, { updatedAt: new Date() });

    return { userMessage, assistantMessage };
  }

  /**
   * Save a message to the database
   */
  private async saveMessage(
    chatId: string,
    role: MessageRole,
    content: string,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      chatId,
      role,
      content,
    });

    return this.messageRepository.save(message);
  }

  /**
   * Retrieve relevant context from user's documents
   */
  private async retrieveContext(
    query: string,
    userId: string,
  ): Promise<string> {
    try {
      const relevantChunks = await this.embeddingsService.searchRelevantChunks(
        query,
        userId,
        this.retrievalTopK,
      );

      if (relevantChunks.length === 0) {
        return '';
      }

      // Format context from retrieved chunks
      const contextParts = relevantChunks.map((chunk, index) => {
        return `[Document ${index + 1}: ${chunk.metadata.filename}]\n${chunk.content}`;
      });

      return contextParts.join('\n\n---\n\n');
    } catch (error) {
      this.logger.warn(`Context retrieval failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Get chat history for context
   */
  private async getChatHistory(chatId: string): Promise<ChatMessage[]> {
    const messages = await this.messageRepository.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
      take: 10, // Last 10 messages for context
    });

    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  /**
   * Generate AI response using Ollama with RAG
   */
  private async generateResponse(
    userMessage: string,
    context: string,
    history: ChatMessage[],
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    try {
      const response = await this.ollamaService.chat(messages, {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2000,
      });

      return response;
    } catch (error) {
      this.logger.error(`AI generation failed: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate response');
    }
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context: string): string {
    if (!context) {
      return 'You are a helpful AI assistant. Provide clear, accurate, and concise responses.';
    }

    return `You are a helpful AI assistant with access to the user's documents.

When answering questions, use the following context from the user's documents:

${context}

Instructions:
- Answer questions based on the provided context when relevant
- If the context doesn't contain information to answer the question, say so
- Be accurate and cite which document you're referring to when possible
- If the question is not related to the documents, answer based on your general knowledge
- Keep responses clear and concise`;
  }

  /**
   * Auto-generate chat title from first message
   */
  private async updateChatTitle(chatId: string, firstMessage: string): Promise<void> {
    try {
      // Generate a short title using LLM
      const titlePrompt: ChatMessage[] = [
        {
          role: 'system',
          content: 'Generate a short, concise title (max 6 words) for a chat that starts with this message. Only respond with the title, nothing else.',
        },
        {
          role: 'user',
          content: firstMessage,
        },
      ];

      const title = await this.ollamaService.chat(titlePrompt, {
        temperature: 0.5,
        maxTokens: 20,
      });

      await this.chatRepository.update(chatId, {
        title: title.trim().substring(0, 100),
      });
    } catch (error) {
      this.logger.warn(`Failed to generate chat title: ${error.message}`);
      // Non-critical error, don't throw
    }
  }

  /**
   * Get message count for a chat
   */
  async getMessageCount(chatId: string): Promise<number> {
    return this.messageRepository.count({ where: { chatId } });
  }
}
```

---

## 3. Chat Controller

### 3.1 Create Chat Controller - `src/modules/chat/chat.controller.ts`

```typescript
import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatResponseDto,
  ChatWithMessagesDto,
  MessageResponseDto,
} from './dto/chat-response.dto';

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
  async listChats(@CurrentUser() user: User): Promise<ChatResponseDto[]> {
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
      messages: chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  @Delete(':id')
  async deleteChat(@Param('id') id: string, @CurrentUser() user: User) {
    await this.chatService.deleteChat(id, user.id);

    return {
      message: 'Chat deleted successfully',
    };
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ) {
    const { userMessage, assistantMessage } = await this.chatService.sendMessage(
      id,
      user.id,
      dto.message,
    );

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
```

---

## 4. Chat Module

### 4.1 Update Chat Module - `src/modules/chat/chat.module.ts`

```typescript
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
```

---

## 5. Testing Chat with RAG

### 5.1 Create a Chat

```bash
curl -X POST http://localhost:3000/api/chats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Chat"
  }'
```

Response:
```json
{
  "id": "chat-uuid",
  "title": "My First Chat",
  "createdAt": "2025-11-14T10:00:00.000Z",
  "updatedAt": "2025-11-14T10:00:00.000Z"
}
```

### 5.2 Send a Message (Without Documents)

```bash
curl -X POST http://localhost:3000/api/chats/CHAT_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is TypeScript?"
  }'
```

### 5.3 Send a Message (With Documents)

First, upload a document (from Step 6-7), then:

```bash
curl -X POST http://localhost:3000/api/chats/CHAT_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize the main points from my documents"
  }'
```

The AI will retrieve relevant chunks and answer based on your documents!

### 5.4 List Chats

```bash
curl http://localhost:3000/api/chats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.5 Get Chat with Messages

```bash
curl http://localhost:3000/api/chats/CHAT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.6 Delete Chat

```bash
curl -X DELETE http://localhost:3000/api/chats/CHAT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 6. Complete End-to-End Test

### 6.1 Full RAG Workflow

```bash
# 1. Register user
TOKEN=$(curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.access_token')

# 2. Upload a document
DOC_ID=$(curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.pdf" \
  | jq -r '.id')

# 3. Wait for processing (check status)
curl http://localhost:3000/api/documents/$DOC_ID \
  -H "Authorization: Bearer $TOKEN"

# 4. Create a chat
CHAT_ID=$(curl -X POST http://localhost:3000/api/chats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Document Q&A"}' \
  | jq -r '.id')

# 5. Ask a question about the document
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What are the key points in my document?"}' \
  | jq '.assistantMessage.content'

# 6. Follow-up question
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Can you elaborate on the first point?"}' \
  | jq '.assistantMessage.content'
```

---

## 7. Common Issues & Troubleshooting

### Issue: No relevant context retrieved
**Solution:**
- Ensure documents are processed (status: "processed")
- Check vector count in Qdrant
- Verify embeddings are being generated correctly

### Issue: Slow response times
**Solution:**
- Reduce `retrievalTopK` in configuration
- Optimize Ollama model (use smaller model if needed)
- Consider caching frequent queries

### Issue: AI doesn't use document context
**Solution:**
- Check system prompt includes context
- Verify chunks are retrieved (add logging)
- Ensure user has processed documents

### Issue: Context too long / Token limit exceeded
**Solution:**
- Reduce `retrievalTopK`
- Reduce `chunkSize` for more granular chunks
- Implement context summarization

---

## 8. Next Steps

✅ **Step 8 Complete! You should now have:**
- Complete chat system with sessions
- Message history storage
- RAG pipeline (retrieval + generation)
- Context-aware AI responses
- Auto-generated chat titles
- Full integration of all modules

**Continue to Step 9:** Testing & Documentation

---

## Quick Commands Reference

```bash
# Create chat
curl -X POST http://localhost:3000/api/chats \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Chat"}'

# Send message
curl -X POST http://localhost:3000/api/chats/CHAT_ID/messages \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Your question here"}'

# List chats
curl http://localhost:3000/api/chats \
  -H "Authorization: Bearer TOKEN"

# Get chat with messages
curl http://localhost:3000/api/chats/CHAT_ID \
  -H "Authorization: Bearer TOKEN"

# Delete chat
curl -X DELETE http://localhost:3000/api/chats/CHAT_ID \
  -H "Authorization: Bearer TOKEN"
```
