import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { OllamaService, ChatMessage } from '../ollama/ollama.service';
import { Chat } from './entities/chat.entity';
import { Message, MessageRole } from './entities/message.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly retrievalTopK: number;

  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly ollamaService: OllamaService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly configService: ConfigService,
  ) {
    this.retrievalTopK =
      this.configService.get<number>('chunking.retrievalTopK') ?? 5;
  }

  /**
   * Create a new chat session for a user.
   */
  async createChat(userId: string, title?: string): Promise<Chat> {
    const chat = this.chatRepository.create({
      userId,
      title: title?.trim() || 'New Chat',
    });

    await this.chatRepository.save(chat);
    this.logger.log(`Created chat ${chat.id} for user ${userId}`);

    return chat;
  }

  /**
   * Return every chat that belongs to a user ordered by last update.
   */
  async getUserChats(userId: string): Promise<Chat[]> {
    return this.chatRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Fetch a chat with the associated messages scoped to the owner.
   */
  async getChatById(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
      relations: ['messages'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.messages) {
      chat.messages.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
    }

    return chat;
  }

  /**
   * Delete a chat that belongs to the requesting user.
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
   * Persist the user message, run the RAG pipeline, and save the AI reply.
   */
  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    const chat = await this.getChatById(chatId, userId);
    const userMessage = await this.saveMessage(
      chatId,
      MessageRole.USER,
      content,
    );

    const context = await this.retrieveContext(content, userId);
    const history = await this.getChatHistory(chatId, userMessage.id);
    const aiResponse = await this.generateResponse(content, context, history);
    const assistantMessage = await this.saveMessage(
      chatId,
      MessageRole.ASSISTANT,
      aiResponse,
    );

    const shouldAutoTitle =
      !chat.title || chat.title.trim().toLowerCase() === 'new chat';
    if (shouldAutoTitle && history.length === 0) {
      await this.updateChatTitle(chatId, content);
    }

    await this.chatRepository.update(chatId, { updatedAt: new Date() });

    return { userMessage, assistantMessage };
  }

  /**
   * Store a message entity.
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
   * Query embeddings/Qdrant and format the resulting context.
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

      if (!relevantChunks.length) {
        return '';
      }

      const contextParts = relevantChunks.map((chunk, index) => {
        const filename =
          chunk.metadata?.filename ?? `Document ${index + 1}`;
        return `[Document ${index + 1}: ${filename}]\n${chunk.content}`;
      });

      return contextParts.join('\n\n---\n\n');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown retrieval error';
      this.logger.warn(`Context retrieval failed: ${message}`);
      return '';
    }
  }

  /**
   * Fetch the recent chat history (excluding the freshly added user message if provided).
   */
  private async getChatHistory(
    chatId: string,
    excludeMessageId?: string,
  ): Promise<ChatMessage[]> {
    const take = excludeMessageId ? 11 : 10;
    const messages = await this.messageRepository.find({
      where: { chatId },
      order: { createdAt: 'DESC' },
      take,
    });

    const filtered = excludeMessageId
      ? messages.filter((message) => message.id !== excludeMessageId)
      : messages;

    return filtered
      .slice(0, 10)
      .reverse()
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      }));
  }

  /**
   * Run the Ollama chat completion using the supplied context and history.
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
      { role: 'user', content: userMessage },
    ];

    try {
      return await this.ollamaService.chat(messages, {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2000,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown generation error';
      this.logger.error(`AI generation failed: ${message}`);
      throw new BadRequestException('Failed to generate response');
    }
  }

  /**
   * Build the system prompt used for each generation.
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
   * Generate a short title based on the first user message.
   */
  private async updateChatTitle(
    chatId: string,
    firstMessage: string,
  ): Promise<void> {
    try {
      const titlePrompt: ChatMessage[] = [
        {
          role: 'system',
          content:
            'Generate a short, concise title (max 6 words) for a chat that starts with this message. Only respond with the title, nothing else.',
        },
        {
          role: 'user',
          content: firstMessage,
        },
      ];

      const generatedTitle = await this.ollamaService.chat(titlePrompt, {
        temperature: 0.5,
        maxTokens: 20,
      });

      const sanitized =
        generatedTitle?.trim().substring(0, 100) ||
        firstMessage.trim().substring(0, 100) ||
        'New Chat';

      await this.chatRepository.update(chatId, { title: sanitized });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown title error';
      this.logger.warn(`Failed to generate chat title: ${message}`);
    }
  }

  /**
   * Return total message count for a chat.
   */
  async getMessageCount(chatId: string): Promise<number> {
    return this.messageRepository.count({ where: { chatId } });
  }
}
