'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLogin, useRegister, useProfile } from '@/hooks/useAuth';
import { getAuthToken, setAuthToken, clearAuthToken } from '@/utils/token';

interface User {
  id?: string;
  email: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { mutateAsync: loginMutate } = useLogin();
  const { mutateAsync: registerMutate } = useRegister();
  const { data: profileData, refetch: refetchProfile } = useProfile();

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = getAuthToken();
    if (storedToken) {
      setToken(storedToken);
      // Fetch user profile
      refetchProfile();
    }
    setIsLoading(false);
  }, [refetchProfile]);

  // Update user when profile is fetched
  useEffect(() => {
    if (profileData) {
      setUser(profileData);
    }
  }, [profileData]);

  // Listen for logout events
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setToken(null);
      clearAuthToken();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:logout', handleLogout);
      return () => window.removeEventListener('auth:logout', handleLogout);
    }
  }, []);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const response = await loginMutate(credentials);
      setToken(response.access_token);
      setAuthToken(response.access_token, response.expires_in);

      // Fetch user profile
      await refetchProfile();
    },
    [loginMutate, refetchProfile]
  );

  const register = useCallback(
    async (data: { email: string; password: string }) => {
      const response = await registerMutate(data);
      setToken(response.access_token);
      setAuthToken(response.access_token, response.expires_in);

      // Fetch user profile
      await refetchProfile();
    },
    [registerMutate, refetchProfile]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearAuthToken();

    // Dispatch event for other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
      window.location.href = '/auth/login';
    }
  }, []);

  const refetchUser = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
