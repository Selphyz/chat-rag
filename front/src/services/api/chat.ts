import { apiClient } from './client';

class ChatService {
  /**
   * Get all user chats
   */
  async getChats(): Promise<any[]> {
    return apiClient.get('/chats');
  }

  /**
   * Get specific chat with messages
   */
  async getChat(chatId: string): Promise<any> {
    return apiClient.get(`/chats/${chatId}`);
  }

  /**
   * Create new chat
   */
  async createChat(data: any): Promise<any> {
    return apiClient.post('/chats', data);
  }

  /**
   * Send message to chat
   */
  async sendMessage(chatId: string, data: any): Promise<any> {
    return apiClient.post(`/chats/${chatId}/messages`, data);
  }

  /**
   * Get chat messages with pagination
   */
  async getMessages(
    chatId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: any[]; total: number }> {
    return apiClient.get(`/chats/${chatId}/messages`, {
      params: { page, limit },
    });
  }

  /**
   * Delete chat
   */
  async deleteChat(chatId: string): Promise<void> {
    return apiClient.delete(`/chats/${chatId}`);
  }
}

export const chatService = new ChatService();
export default ChatService;
