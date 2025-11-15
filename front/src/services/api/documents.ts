import { apiClient } from './client';

class DocumentService {
  /**
   * Get all user documents
   */
  async getDocuments(): Promise<any[]> {
    return apiClient.get('/documents');
  }

  /**
   * Get specific document
   */
  async getDocument(documentId: string): Promise<any> {
    return apiClient.get(`/documents/${documentId}`);
  }

  /**
   * Upload document (file upload with FormData)
   */
  async uploadDocument(file: File): Promise<any> {
    const url = new URL(
      '/documents',
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    );

    const formData = new FormData();
    formData.append('file', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload document');
    }

    return response.json() as Promise<any>;
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    return apiClient.delete(`/documents/${documentId}`);
  }

  /**
   * Re-process failed document
   */
  async reprocessDocument(documentId: string): Promise<any> {
    return apiClient.post(`/documents/${documentId}/reprocess`, {});
  }

  /**
   * Get document processing status
   */
  async getDocumentStatus(documentId: string): Promise<{
    status: 'processing' | 'processed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    return apiClient.get(`/documents/${documentId}/status`);
  }
}

export const documentService = new DocumentService();
export default DocumentService;
