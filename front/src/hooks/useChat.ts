'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatService } from '@/services/api/chat';

export const useChats = () => {
  return useQuery({
    queryKey: ['chats'],
    queryFn: () => chatService.getChats(),
  });
};

export const useChat = (chatId: string) => {
  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => chatService.getChat(chatId),
    enabled: !!chatId,
  });
};

export const useCreateChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => chatService.createChat(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
};

export const useSendMessage = (chatId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => chatService.sendMessage(chatId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    },
  });
};

export const useDeleteChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatId: string) => chatService.deleteChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
};
