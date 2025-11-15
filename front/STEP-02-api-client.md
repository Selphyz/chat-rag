# Step 2: Type-Safe API Client & Services

**Estimated Time:** 2-3 hours
**Prerequisites:** STEP-00 and STEP-01 completed, generated types available
**Status:** Core infrastructure - Required before any API interactions

---

## Overview

This step creates a robust, type-safe API client using the generated OpenAPI types. All API interactions will go through this client, ensuring consistency, error handling, and automatic type safety.

### What You'll Build
- Base API client with fetch or axios
- Request/response interceptors
- JWT token management utilities
- React Query configuration
- Service modules for each API domain (auth, chat, documents)
- Error handling and retry logic
- Type-safe API hooks

---

## 1. React Query Setup

### 1.1 Create React Query Client Configuration

Create file: `src/lib/queryClient.ts`

```typescript
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

// Create a client to store and provide queries
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      console.error('Query error:', error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('Mutation error:', error);
    },
  }),
});

export default queryClient;
```

### 1.2 Update Root Layout with QueryClientProvider

Create/update file: `src/app/layout.tsx`

```typescript
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import queryClient from '@/lib/queryClient';
import { AuthProvider } from '@/context/AuthContext';
import { UIProvider } from '@/context/UIContext';
import React from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <UIProvider>
              {children}
            </UIProvider>
          </AuthProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

---

## 2. Base API Client

### 2.1 Create API Client with Fetch

Create file: `src/services/api/client.ts`

```typescript
import { ApiError } from '@/types/api';

export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get JWT token from localStorage
   */
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Build headers with authentication
   */
  private buildHeaders(): HeadersInit {
    const headers = { ...this.defaultHeaders };
    const token = this.getAuthToken();

    if (token) {
      (headers as any).Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): never {
    if (error instanceof Response) {
      const status = error.status;

      if (status === 401) {
        // Token expired or invalid
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          // Dispatch logout event or redirect to login
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        throw new ApiError('Unauthorized. Please login again.', 'UNAUTHORIZED', 401);
      }

      if (status === 403) {
        throw new ApiError('Permission denied', 'FORBIDDEN', 403);
      }

      if (status === 404) {
        throw new ApiError('Resource not found', 'NOT_FOUND', 404);
      }

      if (status >= 500) {
        throw new ApiError('Server error. Please try again later.', 'SERVER_ERROR', status);
      }
    }

    if (error instanceof Error) {
      throw new ApiError(error.message, 'NETWORK_ERROR', 0);
    }

    throw new ApiError('Unknown error occurred', 'UNKNOWN_ERROR', 0);
  }

  /**
   * Generic request method
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    config?: RequestConfig & { body?: any }
  ): Promise<T> {
    const url = this.buildUrl(path, config?.params);

    const fetchConfig: RequestInit = {
      method,
      headers: this.buildHeaders(),
      ...config,
    };

    // Add body for POST, PUT, PATCH
    if (config?.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchConfig.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, fetchConfig);

      if (!response.ok) {
        throw response;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * GET request
   */
  get<T>(path: string, config?: RequestConfig) {
    return this.request<T>('GET', path, config);
  }

  /**
   * POST request
   */
  post<T>(path: string, body: any, config?: RequestConfig) {
    return this.request<T>('POST', path, { ...config, body });
  }

  /**
   * PUT request
   */
  put<T>(path: string, body: any, config?: RequestConfig) {
    return this.request<T>('PUT', path, { ...config, body });
  }

  /**
   * PATCH request
   */
  patch<T>(path: string, body: any, config?: RequestConfig) {
    return this.request<T>('PATCH', path, { ...config, body });
  }

  /**
   * DELETE request
   */
  delete<T>(path: string, config?: RequestConfig) {
    return this.request<T>('DELETE', path, config);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

export default ApiClient;
```

### 2.2 Create API Error Class

Update file: `src/types/api/index.ts` (add to existing)

```typescript
// ... existing generated types ...

/**
 * Custom API Error class for type-safe error handling
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isNetworkError(): boolean {
    return this.status === 0;
  }
}
```

---

## 3. Authentication Service

### 3.1 Create Authentication API Service

Create file: `src/services/api/auth.ts`

```typescript
import { apiClient } from './client';
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from '@/types/api';

class AuthService {
  /**
   * Register a new user
   */
  register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/api/auth/register', data);
  }

  /**
   * Login with email and password
   */
  login(data: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/api/auth/login', data);
  }

  /**
   * Get current user profile
   */
  getProfile(): Promise<User> {
    return apiClient.get<User>('/api/auth/profile');
  }

  /**
   * Change password
   */
  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return apiClient.post('/api/auth/change-password', {
      oldPassword,
      newPassword,
    });
  }

  /**
   * Logout (client-side only, backend doesn't need to know)
   */
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }
}

export const authService = new AuthService();
export default AuthService;
```

---

## 4. Chat Service

### 4.1 Create Chat API Service

Create file: `src/services/api/chat.ts`

```typescript
import { apiClient } from './client';
import type {
  Chat,
  Message,
  CreateChatRequest,
  SendMessageRequest,
} from '@/types/api';

class ChatService {
  /**
   * Get all user chats
   */
  getChats(): Promise<Chat[]> {
    return apiClient.get<Chat[]>('/api/chats');
  }

  /**
   * Get specific chat with messages
   */
  getChat(chatId: string): Promise<Chat> {
    return apiClient.get<Chat>(`/api/chats/${chatId}`);
  }

  /**
   * Create new chat
   */
  createChat(data: CreateChatRequest): Promise<Chat> {
    return apiClient.post<Chat>('/api/chats', data);
  }

  /**
   * Send message to chat
   */
  sendMessage(chatId: string, data: SendMessageRequest): Promise<Message> {
    return apiClient.post<Message>(`/api/chats/${chatId}/messages`, data);
  }

  /**
   * Get chat messages with pagination
   */
  getMessages(
    chatId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; total: number }> {
    return apiClient.get(`/api/chats/${chatId}/messages`, {
      params: { page, limit },
    });
  }

  /**
   * Delete chat
   */
  deleteChat(chatId: string): Promise<void> {
    return apiClient.delete(`/api/chats/${chatId}`);
  }
}

export const chatService = new ChatService();
export default ChatService;
```

---

## 5. Document Service

### 5.1 Create Document API Service

Create file: `src/services/api/documents.ts`

```typescript
import { apiClient } from './client';
import type { Document, DocumentUploadRequest } from '@/types/api';

class DocumentService {
  /**
   * Get all user documents
   */
  getDocuments(): Promise<Document[]> {
    return apiClient.get<Document[]>('/api/documents');
  }

  /**
   * Get specific document
   */
  getDocument(documentId: string): Promise<Document> {
    return apiClient.get<Document>(`/api/documents/${documentId}`);
  }

  /**
   * Upload document (file upload with FormData)
   */
  async uploadDocument(file: File): Promise<Document> {
    const url = new URL(
      '/api/documents',
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

    return response.json() as Promise<Document>;
  }

  /**
   * Delete document
   */
  deleteDocument(documentId: string): Promise<void> {
    return apiClient.delete(`/api/documents/${documentId}`);
  }

  /**
   * Re-process failed document
   */
  reprocessDocument(documentId: string): Promise<Document> {
    return apiClient.post<Document>(`/api/documents/${documentId}/reprocess`, {});
  }

  /**
   * Get document processing status
   */
  getDocumentStatus(documentId: string): Promise<{
    status: 'processing' | 'processed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    return apiClient.get(`/api/documents/${documentId}/status`);
  }
}

export const documentService = new DocumentService();
export default DocumentService;
```

---

## 6. React Query Hooks

### 6.1 Create Auth Hooks

Create file: `src/hooks/useAuth.ts`

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { authService } from '@/services/api/auth';
import type { LoginRequest, RegisterRequest, AuthResponse, User } from '@/types/api';

export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: (data: AuthResponse) => {
      // Store token
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.access_token);
      }
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
    onSuccess: (data: AuthResponse) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.access_token);
      }
    },
  });
};

export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => authService.getProfile(),
    retry: 1,
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      authService.changePassword(oldPassword, newPassword),
  });
};

export const useLogout = () => {
  return () => {
    authService.logout();
    // Invalidate all queries on logout
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  };
};
```

### 6.2 Create Chat Hooks

Create file: `src/hooks/useChat.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatService } from '@/services/api/chat';
import type { Chat, CreateChatRequest, SendMessageRequest } from '@/types/api';

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
    mutationFn: (data: CreateChatRequest) => chatService.createChat(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
};

export const useSendMessage = (chatId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageRequest) => chatService.sendMessage(chatId, data),
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
```

### 6.3 Create Document Hooks

Create file: `src/hooks/useDocuments.ts`

```typescript
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
```

---

## 7. Token Management Utilities

### 7.1 Create Token Utility Functions

Create file: `src/utils/token.ts`

```typescript
export const TOKEN_KEY = 'auth_token';
export const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

/**
 * Store JWT token in localStorage
 */
export function setAuthToken(token: string, expiresIn?: number): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(TOKEN_KEY, token);

  if (expiresIn) {
    const expiryTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }
}

/**
 * Get JWT token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Remove JWT token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(): boolean {
  if (typeof window === 'undefined') return true;

  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return false;

  return Date.now() > parseInt(expiry, 10);
}

/**
 * Get token expiry time remaining in seconds
 */
export function getTokenExpiryIn(): number {
  if (typeof window === 'undefined') return 0;

  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return 0;

  const remaining = parseInt(expiry, 10) - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Parse JWT token (basic implementation)
 */
export function parseJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
}
```

---

## 8. Error Handling Utilities

### 8.1 Create Error Handler

Create file: `src/utils/errors.ts`

```typescript
import { ApiError } from '@/types/api';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function handleApiError(error: unknown): void {
  const message = getErrorMessage(error);
  console.error('API Error:', message);

  if (isApiError(error)) {
    if (error.isUnauthorized()) {
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  }
}
```

---

## 9. Testing the API Client

### 9.1 Create Test File

Create file: `src/services/api/__tests__/client.test.ts`

```typescript
import { apiClient } from '../client';

describe('API Client', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should make GET request', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const result = await apiClient.get('/test');
    expect(result).toEqual({ success: true });
  });

  it('should include auth token in headers', async () => {
    localStorage.setItem('auth_token', 'test-token');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await apiClient.get('/test');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });
});
```

---

## 10. Verification Checklist

- [ ] React Query client created in `src/lib/queryClient.ts`
- [ ] QueryClientProvider added to root layout
- [ ] Base API client created with type safety
- [ ] Authentication service created with all methods
- [ ] Chat service created with all methods
- [ ] Document service created with all methods
- [ ] All React Query hooks created (useAuth, useChat, useDocuments)
- [ ] Token utilities created and tested
- [ ] Error handling utilities implemented
- [ ] All imports resolve correctly (no TypeScript errors)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## 11. Troubleshooting

### Issue: "Cannot find module '@/types/api'"
**Solution:** Ensure generated types exist and tsconfig paths are correct
```bash
npm run generate:types
```

### Issue: "fetch is not defined"
**Solution:** Add fetch polyfill for Node environment or check browser environment
```typescript
if (typeof window === 'undefined') return null;
```

### Issue: "localStorage is not defined"
**Solution:** Always check for browser environment before using localStorage
```typescript
if (typeof window !== 'undefined') {
  localStorage.setItem('token', value);
}
```

### Issue: React Query queries not working
**Solution:** Ensure QueryClientProvider wraps entire app in layout

---

## 12. Next Steps

After completing this step:
1. ✅ Verify `npm run type-check` passes
2. ✅ Test API client with simple requests
3. → Proceed to **STEP-03-authentication.md**

---

## References

- [React Query Documentation](https://tanstack.com/query/latest)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [JWT Authentication](https://jwt.io/introduction)
- [Error Handling Patterns](https://javascript.info/fetch-api#error-handling)
