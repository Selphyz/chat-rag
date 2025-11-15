'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentService } from '@/services/api/documents';

export const useDocuments = () => {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () => documentService.getDocuments(),
  });
};

export const useDocument = (documentId: string) => {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentService.getDocument(documentId),
    enabled: !!documentId,
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => documentService.uploadDocument(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => documentService.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

export const useDocumentStatus = (documentId: string) => {
  return useQuery({
    queryKey: ['document-status', documentId],
    queryFn: () => documentService.getDocumentStatus(documentId),
    enabled: !!documentId,
    refetchInterval: 2000, // Poll every 2 seconds
  });
};
