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
