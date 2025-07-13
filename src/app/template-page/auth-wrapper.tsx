"use client";

import { AuthErrorBoundary } from "~/components/ui/auth-error-boundary";
import { ErrorBoundary } from "~/components/ui/error-boundary";
import { clientApi } from "~/trpc/react";
import { CardSkeleton } from "~/components/ui/skeleton";

interface AuthPageWrapperProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthPageWrapper({ 
  children, 
  title = "Template Page Access",
  description = "Please login to access template features and manage your configurations."
}: AuthPageWrapperProps) {
  // Get user data to check authentication
  const { data: userData, isLoading } = clientApi.internal.getUserData.useQuery();
  
  // Check if user is authenticated
  const isAuthenticated = !!userData?.UID;

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center mb-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthErrorBoundary
        isAuthenticated={isAuthenticated}
        title={title}
        description={description}
        requiresAuth={true}
      >
        {children}
      </AuthErrorBoundary>
    </ErrorBoundary>
  );
} 