"use client";

import { useState } from "react";
import { Shield, User, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { AuthModal } from "~/components/ui/login-modal";

interface AuthErrorBoundaryProps {
  isAuthenticated: boolean;
  children: React.ReactNode;
  title?: string;
  description?: string;
  requiresAuth?: boolean;
  fallbackComponent?: React.ReactNode;
}

export function AuthErrorBoundary({ 
  isAuthenticated, 
  children, 
  title = "Authentication Required",
  description = "Please login to access this feature",
  requiresAuth = true,
  fallbackComponent
}: AuthErrorBoundaryProps) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // If auth is not required, always show children
  if (!requiresAuth) {
    return <>{children}</>;
  }

  // If user is authenticated, show children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // If custom fallback is provided, use it
  if (fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  // Default auth error UI
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => setIsLoginModalOpen(true)}
            className="w-full"
            size="lg"
          >
            <User className="mr-2 h-4 w-4" />
            Login to Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="text-sm"
            >
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          setIsLoginModalOpen(false);
          // Refresh page to update auth state
          window.location.reload();
        }}
      />
    </div>
  );
}

// Hook for checking auth state in components
export function useAuthGuard() {
  // This could be expanded to include more auth-related utilities
  return {
    requireAuth: (isAuthenticated: boolean) => {
      if (!isAuthenticated) {
        throw new Error("Authentication required");
      }
    }
  };
} 