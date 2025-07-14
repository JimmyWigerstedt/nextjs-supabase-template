"use client";

import { User, CreditCard, Mail, Calendar, Settings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { AuthErrorBoundary } from "~/components/ui/auth-error-boundary";
import { ErrorBoundary } from "~/components/ui/error-boundary";
import { TextLinesSkeleton } from "~/components/ui/skeleton";
import { clientApi } from "~/trpc/react";
import { toast } from "sonner";
import { AppHeader } from "~/components/layout/AppHeader";

export function SettingsClient() {
  
  // Get user data
  const { data: userData, isLoading: isLoadingUserData, refetch: refetchUserData } = clientApi.internal.getUserData.useQuery();
  
  // Get current subscription
  const { data: currentSubscription, isLoading: isLoadingSubscription } = clientApi.payments.getCurrentSubscription.useQuery();
  
  // Create portal session for subscription management
  const createPortal = clientApi.payments.createCustomerPortalSession.useMutation({
    onSuccess: (data) => {
      toast.success('Opening billing portal...');
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to open billing portal: ${error.message}`);
    },
  });



  // Check if user is authenticated
  const isAuthenticated = !!userData?.UID;


  // Format date helper
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString();
  };

  // Get subscription status display
  const getSubscriptionStatus = () => {
    if (isLoadingSubscription) return "Loading...";
    if (!currentSubscription) return "No active subscription";
    
    const status = currentSubscription.status;
    
    switch (status) {
      case 'active':
        return `Active`;
      case 'past_due':
        return `Past Due`;
      case 'canceled':
        return `Canceled`;
      default:
        return status;
    }
  };

  // Get plan name from subscription or userData
  const getPlanName = () => {
    if (isLoadingSubscription || isLoadingUserData) return "Loading...";
    
    // Try to get plan from userData first (more reliable)
    if (userData?.subscription_plan) {
      return userData.subscription_plan.charAt(0).toUpperCase() + userData.subscription_plan.slice(1);
    }
    
    return "Free Plan";
  };



  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader currentPage="Settings" showBackButton={true} backButtonText="← Back to Dashboard" backButtonHref="/dashboard" />
      <ErrorBoundary>
        <AuthErrorBoundary
          isAuthenticated={isAuthenticated}
          title="Settings Access Required"
          description="Please login to access your account settings and preferences."
        >
          <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center space-x-3 mb-8">
            <Settings className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">Manage your account and preferences</p>
            </div>
          </div>

          {/* Profile Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
              <CardDescription>
                Your basic account information and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingUserData ? (
                <div className="space-y-4">
                  <TextLinesSkeleton lines={3} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>Email Address</span>
                    </Label>
                                         <p className="text-gray-900 font-medium">{userData?.email ?? "Not provided"}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Member Since</span>
                    </Label>
                    <p className="text-gray-900 font-medium">{formatDate(userData?.created_at)}</p>
                  </div>
                  
                                     <div className="space-y-2">
                     <Label>Total Credits</Label>
                     <p className="text-gray-900 font-medium">
                       {userData?.usage_credits ? parseInt(String(userData.usage_credits), 10).toLocaleString() : "0"}
                     </p>
                     <p className="text-xs text-gray-500">Credits never expire and are cumulative</p>
                   </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Management Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Subscription Management</span>
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingSubscription ? (
                <TextLinesSkeleton lines={2} />
              ) : (
                                 <div className="space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <Label>Current Plan</Label>
                       <p className="text-gray-900 font-medium">{getPlanName()}</p>
                     </div>
                     
                     <div className="space-y-2">
                       <Label>Status</Label>
                       <p className="text-gray-900 font-medium">{getSubscriptionStatus()}</p>
                     </div>
                   </div>
                   
                   {currentSubscription && (
                     <div className="flex justify-end pt-4">
                       <Button
                         onClick={() => createPortal.mutate()}
                         disabled={createPortal.isPending}
                         className="flex items-center space-x-2"
                       >
                         <CreditCard className="h-4 w-4" />
                         <span>{createPortal.isPending ? 'Opening...' : 'Manage Subscription'}</span>
                       </Button>
                     </div>
                   )}
                  
                  {!currentSubscription && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-800 mb-2">No active subscription</p>
                      <p className="text-blue-600 text-sm">
                        <a href="/pricing" className="underline hover:no-underline">
                          View available plans
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          </div>
        </AuthErrorBoundary>
      </ErrorBoundary>
    </div>
  );
} 