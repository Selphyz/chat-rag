import { apiClient } from './client';

class AuthService {
  /**
   * Register a new user
   */
  async register(data: any): Promise<any> {
    return apiClient.post('/auth/register', data);
  }

  /**
   * Login with email and password
   */
  async login(data: any): Promise<any> {
    return apiClient.post('/auth/login', data);
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<any> {
    return apiClient.get('/auth/profile');
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return apiClient.post('/auth/change-password', {
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
