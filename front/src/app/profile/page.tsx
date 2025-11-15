'use client';

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/layouts/MainLayout';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUIContext } from '@/contexts/UIContext';

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
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
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
