"use client";

import { useState } from "react";
import { User, CreditCard, Trash2, Mail, Calendar, Shield, Settings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { AuthErrorBoundary } from "~/components/ui/auth-error-boundary";
import { ErrorBoundary } from "~/components/ui/error-boundary";
import { CardSkeleton, TextLinesSkeleton } from "~/components/ui/skeleton";
import { clientApi } from "~/trpc/react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const profileSchema = z.object({
  email: z.string().email().optional(),
});

type ProfileFormType = z.infer<typeof profileSchema>;

export function SettingsClient() {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
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

  // Update user data mutation
  const updateUserData = clientApi.internal.updateUserData.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      void refetchUserData();
    },
    onError: (error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  // Delete account mutation
  const deleteAccount = clientApi.internal.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted successfully. You will be redirected to the home page.");
      // Redirect to home page and clear auth state
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });

  // Form for profile editing
  const form = useForm<ProfileFormType>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: userData?.email || "",
    },
  });

  // Check if user is authenticated
  const isAuthenticated = !!userData?.UID;

  // Handle profile form submission
  const onSubmit = async (data: ProfileFormType) => {
    if (data.email && data.email !== userData?.email) {
      updateUserData.mutate({ email: data.email });
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error("Please type 'DELETE' to confirm account deletion");
      return;
    }

    // Call the delete account mutation
    deleteAccount.mutate();
    setIsDeleteModalOpen(false);
    setDeleteConfirmText("");
  };

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

  return (
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
                    <p className="text-gray-900 font-medium">{userData?.email || "Not provided"}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Member Since</span>
                    </Label>
                    <p className="text-gray-900 font-medium">{formatDate(userData?.created_at)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <p className="text-gray-600 font-mono text-sm">{userData?.UID}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Available Credits</Label>
                    <p className="text-gray-900 font-medium">
                      {userData?.usage_credits ? parseInt(userData.usage_credits as string, 10).toLocaleString() : "0"}
                    </p>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Current Plan</Label>
                      <p className="text-gray-900 font-medium">{getSubscriptionStatus()}</p>
                    </div>
                    {currentSubscription && (
                      <Button
                        onClick={() => createPortal.mutate()}
                        disabled={createPortal.isPending}
                        className="flex items-center space-x-2"
                      >
                        <CreditCard className="h-4 w-4" />
                        <span>{createPortal.isPending ? 'Opening...' : 'Manage Subscription'}</span>
                      </Button>
                    )}
                  </div>
                  
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

          {/* Account Actions Card */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <Shield className="h-5 w-5" />
                <span>Account Actions</span>
              </CardTitle>
              <CardDescription>
                Manage your account security and data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Delete Account</Label>
                  <p className="text-gray-600 text-sm">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteModalOpen(true)}
                  disabled={deleteAccount.isPending}
                  className="flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{deleteAccount.isPending ? "Deleting..." : "Delete Account"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Account Modal */}
          {isDeleteModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-red-600">Delete Account</CardTitle>
                  <CardDescription>
                    This action cannot be undone. All your data will be permanently deleted.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type "DELETE" to confirm</Label>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDeleteModalOpen(false);
                        setDeleteConfirmText("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== "DELETE"}
                    >
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </AuthErrorBoundary>
    </ErrorBoundary>
  );
} 