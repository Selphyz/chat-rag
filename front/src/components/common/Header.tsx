'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUIContext } from '@/contexts/UIContext';

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
