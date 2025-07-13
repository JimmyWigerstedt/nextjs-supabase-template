"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Settings, CreditCard, Menu, X, ChevronDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import { AuthModal } from "~/components/ui/login-modal";
import { UserDataSkeleton } from "~/components/ui/skeleton";
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

  // Stripe portal mutation for billing management
  const createPortal = clientApi.payments.createCustomerPortalSession.useMutation({
    onSuccess: (data) => {
      toast.success('Opening billing portal...');
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to open billing portal: ${error.message}`);
    },
  });

  // Fetch user data (primary source for plan/credits - cached and fast)
  const { data: userData, isLoading: isLoadingUserData } = clientApi.internal.getUserData.useQuery();

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
    if (credits === null || credits === undefined) return "Total Credits: —";
    const creditsNum = typeof credits === 'string' ? parseInt(credits, 10) : credits;
    return isNaN(creditsNum) ? "Total Credits: —" : `Total Credits: ${creditsNum.toLocaleString()}`;
  };

  // Get current plan display - using local database first (cache-first approach)
  const getCurrentPlan = () => {
    if (isLoadingUserData) return "Loading...";
    
    const subscriptionStatus = userData?.subscription_status;
    const planName = userData?.subscription_plan;
    
    // Check subscription status from local database
    if (subscriptionStatus === 'active' && planName) {
      // Capitalize plan name for display
      return planName.charAt(0).toUpperCase() + planName.slice(1);
    } else if (subscriptionStatus === 'past_due') {
      return "Past Due - Check Billing";
    }
    
    // Default to Free Plan if no active subscription
    return "Free Plan";
  };
  
  // Get plan status styling
  const getPlanStatusStyling = () => {
    const subscriptionStatus = userData?.subscription_status;
    
    if (subscriptionStatus === 'past_due') {
      return {
        containerClass: "bg-red-50 border-red-200",
        dotClass: "bg-red-500",
        textClass: "text-red-700"
      };
    } else if (subscriptionStatus === 'active') {
      return {
        containerClass: "bg-green-50 border-green-200", 
        dotClass: "bg-green-500",
        textClass: "text-green-700"
      };
    }
    
    // Free plan styling
    return {
      containerClass: "bg-gray-50 border-gray-200",
      dotClass: "bg-gray-500", 
      textClass: "text-gray-700"
    };
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
            {isLoadingUserData ? (
              /* Show skeleton while loading */
              <UserDataSkeleton />
            ) : isAuthenticated ? (
              <>
                {/* Credits display - clickable to go to pricing */}
                <Link href="/pricing">
                  <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full border cursor-pointer hover:bg-blue-100 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium text-blue-700">
                      {formatCredits()}
                    </span>
                  </div>
                </Link>

                {/* Plan status - clickable to go to pricing */}
                <Link href="/pricing">
                  <div className={`hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full border cursor-pointer transition-colors ${
                    getPlanStatusStyling().containerClass
                  } hover:opacity-80`}>
                    <div className={`w-2 h-2 rounded-full ${getPlanStatusStyling().dotClass}`} />
                    <span className={`text-sm font-medium ${getPlanStatusStyling().textClass}`}>
                      {getCurrentPlan()}
                    </span>
                  </div>
                </Link>

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
                    {userData?.email && (
                      <div className="px-2 py-1">
                        <p className="text-sm text-gray-600">{userData.email}</p>
                      </div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Profile & Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => createPortal.mutate()}
                      disabled={createPortal.isPending}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>{createPortal.isPending ? 'Opening...' : 'Plans & Billing'}</span>
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
                  <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full border cursor-pointer hover:bg-blue-100 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-blue-700">
                        {formatCredits()}
                      </span>
                    </div>
                  </Link>
                  <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border cursor-pointer transition-colors ${
                      getPlanStatusStyling().containerClass
                    } hover:opacity-80`}>
                      <div className={`w-2 h-2 rounded-full ${getPlanStatusStyling().dotClass}`} />
                      <span className={`text-sm font-medium ${getPlanStatusStyling().textClass}`}>
                        {getCurrentPlan()}
                      </span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
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