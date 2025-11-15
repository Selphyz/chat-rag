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
