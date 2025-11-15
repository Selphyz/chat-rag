export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

export function isApiError(error: unknown): error is Error & { code?: string; status?: number } {
  return error instanceof Error && (hasProperty(error, 'code') || hasProperty(error, 'status'));
}

function hasProperty(obj: unknown, prop: string): boolean {
  return obj !== null && typeof obj === 'object' && prop in obj;
}

export function handleApiError(error: unknown): void {
  const message = getErrorMessage(error);
  console.error('API Error:', message);

  if (isApiError(error)) {
    if (error.status === 401) {
      // Redirect to login for unauthorized
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  }
}
