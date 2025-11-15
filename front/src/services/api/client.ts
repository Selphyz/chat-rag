export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api') {
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
