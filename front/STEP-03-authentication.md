# Step 3: Authentication Pages & User Context

**Estimated Time:** 3-4 hours
**Prerequisites:** STEP-00, STEP-01, and STEP-02 completed
**Status:** Critical feature - Required before accessing app

---

## Overview

This step implements complete authentication flow including login, registration, JWT token management, auth context, and protected routes.

### What You'll Build
- Login page with form validation
- Register page with form validation
- Auth context for global state
- Protected route middleware/HOC
- Token refresh logic
- Profile page
- Logout functionality

---

## 1. Auth Context Setup

### 1.1 Create Auth Context

Create file: `src/context/AuthContext.tsx`

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLogin, useRegister, useProfile } from '@/hooks/useAuth';
import { getAuthToken, setAuthToken, clearAuthToken } from '@/utils/token';
import type { User, LoginRequest, RegisterRequest } from '@/types/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
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
    async (credentials: LoginRequest) => {
      const response = await loginMutate(credentials);
      setToken(response.access_token);
      setAuthToken(response.access_token, response.expires_in);

      // Fetch user profile
      await refetchProfile();
    },
    [loginMutate, refetchProfile]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
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
```

### 1.2 Create UI Context

Create file: `src/context/UIContext.tsx`

```typescript
'use client';

import React, { createContext, useContext, useState } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface UIContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toasts: Toast[];
  addToast: (message: string, type: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast['type'], duration = 3000) => {
    const id = Date.now().toString();
    const toast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <UIContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUIContext() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within UIProvider');
  }
  return context;
}
```

---

## 2. Protected Routes & Layout

### 2.1 Create Protected Route HOC

Create file: `src/components/ProtectedRoute.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthContext();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

### 2.2 Create Main Layout

Create file: `src/components/layouts/MainLayout.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import Sidebar from '@/components/common/Sidebar';
import Toast from '@/components/common/Toast';
import { useUIContext } from '@/context/UIContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { sidebarOpen, toasts } = useUIContext();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} />

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
```

### 2.3 Create Auth Layout

Create file: `src/components/layouts/AuthLayout.tsx`

```typescript
'use client';

import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Chat RAG</h1>
          {title && <h2 className="mt-6 text-2xl font-bold text-gray-900">{title}</h2>}
          {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
        </div>

        {/* Form */}
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 shadow sm:px-6">
          {children}
        </div>

        {/* Footer links */}
        <p className="text-center text-sm text-gray-600">
          By using Chat RAG, you agree to our{' '}
          <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
```

---

## 3. Login Page

### 3.1 Create Login Form Component

Create file: `src/components/forms/LoginForm.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthContext } from '@/context/AuthContext';
import { useUIContext } from '@/context/UIContext';
import type { LoginRequest } from '@/types/api';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuthContext();
  const { addToast } = useUIContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);

    try {
      await login(data);
      addToast('Login successful!', 'success');
      router.push('/chat');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed. Please try again.';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Email field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          autoComplete="email"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          {...register('password')}
          id="password"
          type="password"
          autoComplete="current-password"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>

      {/* Sign up link */}
      <p className="text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <a href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
          Sign up
        </a>
      </p>
    </form>
  );
}
```

### 3.2 Create Login Page

Create file: `src/app/auth/login/page.tsx`

```typescript
import AuthLayout from '@/components/layouts/AuthLayout';
import LoginForm from '@/components/forms/LoginForm';

export default function LoginPage() {
  return (
    <AuthLayout title="Sign in to your account" subtitle="Welcome back!">
      <LoginForm />
    </AuthLayout>
  );
}
```

---

## 4. Register Page

### 4.1 Create Register Form Component

Create file: `src/components/forms/RegisterForm.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthContext } from '@/context/AuthContext';
import { useUIContext } from '@/context/UIContext';
import type { RegisterRequest } from '@/types/api';

const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const router = useRouter();
  const { register: registerUser } = useAuthContext();
  const { addToast } = useUIContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);

    try {
      await registerUser({
        email: data.email,
        password: data.password,
      });
      addToast('Registration successful!', 'success');
      router.push('/chat');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Registration failed. Please try again.';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Email field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          autoComplete="email"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          {...register('password')}
          id="password"
          type="password"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {/* Confirm Password field */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm password
        </label>
        <input
          {...register('confirmPassword')}
          id="confirmPassword"
          type="password"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms checkbox */}
      <div className="flex items-center">
        <input
          {...register('acceptTerms')}
          id="acceptTerms"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-600">
          I accept the terms and conditions
        </label>
      </div>
      {errors.acceptTerms && (
        <p className="text-sm text-red-600">{errors.acceptTerms.message}</p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>

      {/* Sign in link */}
      <p className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
          Sign in
        </a>
      </p>
    </form>
  );
}
```

### 4.2 Create Register Page

Create file: `src/app/auth/register/page.tsx`

```typescript
import AuthLayout from '@/components/layouts/AuthLayout';
import RegisterForm from '@/components/forms/RegisterForm';

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started with Chat RAG"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
```

---

## 5. Profile Page

### 5.1 Create Profile Page

Create file: `src/app/profile/page.tsx`

```typescript
'use client';

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/layouts/MainLayout';
import { useAuthContext } from '@/context/AuthContext';
import { useUIContext } from '@/context/UIContext';

export default function ProfilePage() {
  const { user, logout } = useAuthContext();
  const { addToast } = useUIContext();

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      addToast('Logged out successfully', 'success');
    }
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h1 className="text-2xl font-bold">Profile</h1>
            </div>

            <div className="px-6 py-4">
              {user ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-gray-900">{user.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Member since
                    </label>
                    <p className="mt-1 text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <p>Loading...</p>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
```

---

## 6. Common Components

### 6.1 Create Header Component

Create file: `src/components/common/Header.tsx`

```typescript
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/context/AuthContext';
import { useUIContext } from '@/context/UIContext';

export default function Header() {
  const { user, logout } = useAuthContext();
  const { setSidebarOpen, sidebarOpen } = useUIContext();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 hover:bg-gray-100 md:hidden"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Chat RAG</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-gray-600">{user.email}</span>
              <Link href="/profile" className="rounded-lg p-2 hover:bg-gray-100">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </Link>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

### 6.2 Create Sidebar Component

Create file: `src/components/common/Sidebar.tsx`

```typescript
'use client';

import React from 'react';
import Link from 'next/link';

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  return (
    <aside
      className={`${
        isOpen ? 'w-64' : 'w-0'
      } border-r border-gray-200 bg-white transition-all duration-200 overflow-hidden md:block`}
    >
      <nav className="space-y-2 p-4">
        <Link
          href="/chat"
          className="flex items-center gap-3 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Chat
        </Link>

        <Link
          href="/documents"
          className="flex items-center gap-3 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          Documents
        </Link>
      </nav>
    </aside>
  );
}
```

### 6.3 Create Loading Spinner

Create file: `src/components/common/LoadingSpinner.tsx`

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-blue-600`}
      />
    </div>
  );
}
```

### 6.4 Create Toast Notification

Create file: `src/components/common/Toast.tsx`

```typescript
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const typeStyles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${typeStyles[type]}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{message}</p>
        <button onClick={onClose} className="ml-4 text-lg font-bold">
          ×
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Verification Checklist

- [ ] Auth context created and provides login/register/logout
- [ ] UI context created for global state
- [ ] Login page functional with form validation
- [ ] Register page functional with form validation
- [ ] Protected route middleware working
- [ ] Main layout with sidebar and header
- [ ] Profile page shows user info
- [ ] Logout functionality works
- [ ] Token stored and retrieved from localStorage
- [ ] All imports resolve (no TypeScript errors)
- [ ] Navigation between pages works

---

## 8. Testing

### 8.1 Test Login Flow

1. Navigate to http://localhost:3000/auth/login
2. Enter email and password
3. Click "Sign in"
4. Should redirect to /chat
5. User should be stored in context

### 8.2 Test Register Flow

1. Navigate to http://localhost:3000/auth/register
2. Fill in all fields
3. Click "Create account"
4. Should redirect to /chat

### 8.3 Test Protected Routes

1. Log out
2. Try to access /chat directly
3. Should redirect to /auth/login

---

## 9. Next Steps

After completing this step:
1. ✅ Verify login/register flows work
2. ✅ Verify protected routes redirect
3. → Proceed to **STEP-04-chat-interface.md**

---

## References

- [React Context API](https://react.dev/reference/react/useContext)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [Next.js Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
