"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Settings, CreditCard, Menu, X, ChevronDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import { LoginModal } from "~/components/ui/login-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { clientApi } from "~/trpc/react";
import { supabaseBrowser } from "~/util/supabase/browser";
import { toast } from "sonner";

interface AppHeaderProps {
  currentPage?: string;
  showBackButton?: boolean;
  backButtonText?: string;
  backButtonHref?: string;
}

export function AppHeader({ 
  currentPage = "Dashboard", 
  showBackButton = false,
  backButtonText = "← Back to Dashboard",
  backButtonHref = "/dashboard"
}: AppHeaderProps) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const utils = clientApi.useUtils();

  // Fetch user data and subscription info
  const { data: userData, isLoading: isLoadingUserData } = clientApi.internal.getUserData.useQuery();
  const { data: currentSubscription, isLoading: isLoadingSubscription } = clientApi.payments.getCurrentSubscription.useQuery();

  // Check if user is authenticated
  const isAuthenticated = userData?.UID ? true : false;

  // Handle logout
  const handleLogout = async () => {
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();
      await utils.invalidate();
      router.push("/");
      router.refresh();
      toast.success("Successfully logged out");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error logging out");
    }
  };

  // Format credits display
  const formatCredits = () => {
    if (isLoadingUserData) return "Loading...";
    const credits = userData?.usage_credits;
    if (credits === null || credits === undefined) return "Credits: —";
    const creditsNum = typeof credits === 'string' ? parseInt(credits, 10) : credits;
    return isNaN(creditsNum) ? "Credits: —" : `Credits: ${creditsNum.toLocaleString()}`;
  };

  // Get current plan display
  const getCurrentPlan = () => {
    if (isLoadingSubscription) return "Loading...";
    if (currentSubscription?.status === 'active') {
      // For active subscriptions, use the local subscription_plan data
      return userData?.subscription_plan ?? "Pro Plan";
    }
    return userData?.subscription_plan ?? "Free Plan";
  };

  // Navigation links
  const navigationLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/pricing", label: "Pricing" },
    { href: "/n8n-demo", label: "N8N Demo" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo and navigation */}
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-xl font-bold text-gray-900">
                N8N Templates
              </Link>
            </div>

            {/* Back button (if enabled) */}
            {showBackButton && (
              <Link href={backButtonHref}>
                <Button variant="outline" size="sm">
                  {backButtonText}
                </Button>
              </Link>
            )}

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    currentPage === link.label
                      ? "text-primary"
                      : "text-gray-500"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side - User info and menu */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Credits display */}
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full border">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-blue-700">
                    {formatCredits()}
                  </span>
                </div>

                {/* Plan status */}
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-full border">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">
                    {getCurrentPlan()}
                  </span>
                </div>

                {/* User menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">Account</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Profile & Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Billing & Usage</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              /* Login button for unauthenticated users */
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsLoginModalOpen(true)}
              >
                Login
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-2 text-base font-medium transition-colors hover:text-primary ${
                    currentPage === link.label
                      ? "text-primary"
                      : "text-gray-500"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Mobile user info */}
              {isAuthenticated && (
                <div className="px-3 py-2 space-y-2">
                  <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full border">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium text-blue-700">
                      {formatCredits()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-full border">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      {getCurrentPlan()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          setIsLoginModalOpen(false);
          // Refresh to update auth state
          window.location.reload();
        }}
      />
    </header>
  );
} 