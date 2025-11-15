'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { authService } from '@/services/api/auth';

export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials: any) => authService.login(credentials),
    onSuccess: (data: any) => {
      // Store token
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.access_token);
      }
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: (data: any) => authService.register(data),
    onSuccess: (data: any) => {
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
