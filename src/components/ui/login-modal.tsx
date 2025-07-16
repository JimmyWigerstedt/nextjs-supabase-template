"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { supabaseBrowser } from "~/util/supabase/browser";
import { clientApi } from "~/trpc/react";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

type LoginFormType = z.infer<typeof loginSchema>;
type SignupFormType = z.infer<typeof signupSchema>;
type ForgotPasswordFormType = z.infer<typeof forgotPasswordSchema>;

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'login' }: AuthModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'email-sent' | 'forgot-password' | 'reset-email-sent'>(initialMode);
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [resetEmail, setResetEmail] = useState<string>('');
  
  const loginForm = useForm<LoginFormType>({
    resolver: zodResolver(loginSchema),
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormType>({
    resolver: zodResolver(signupSchema),
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormType>({
    resolver: zodResolver(forgotPasswordSchema),
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
    },
  });

  // Initialize user data after successful login/signup to sync email
  const { mutate: initializeUserData } = clientApi.internal.initializeUserData.useMutation({
    onSuccess: () => {
      console.log("User data initialized successfully after auth");
    },
    onError: (error) => {
      console.error("Failed to initialize user data after auth:", error);
    },
  });

  const onLoginSubmit = async (data: LoginFormType) => {
    const { email, password } = data;
    setIsSubmitting(true);
    
    try {
      const supabase = supabaseBrowser();
      const authResponse = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authResponse.error) {
        toast.error(`Error signing in - ${authResponse.error.message}`);
        return;
      }

      toast.success("Successfully logged in!");
      
      // Initialize user data to sync email
      initializeUserData();
      
      // Reset form
      loginForm.reset();
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Close modal
      onClose();
      
      // Refresh page to update auth state
      window.location.reload();
      
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignupSubmit = async (data: SignupFormType) => {
    const { email, password, firstName, lastName } = data;
    setIsSubmitting(true);
    
    try {
      const supabase = supabaseBrowser();
      const authResponse = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            firstName,
            lastName,
          },
        },
      });

      if (authResponse.error) {
        toast.error(`Error signing up - ${authResponse.error.message}`);
        return;
      }

      if (!authResponse.data.user?.id) {
        toast.error("Error signing up. That email might be taken already.");
        return;
      }

      // Store the email for the confirmation screen
      setSignupEmail(email);
      
      // Switch to email sent mode instead of closing
      setMode('email-sent');
      
      // Reset form
      signupForm.reset();
      
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormType) => {
    const { email } = data;
    setIsSubmitting(true);
    
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(`Error sending reset email - ${error.message}`);
        return;
      }

      toast.success("Password reset email sent! Check your inbox.");
      
      // Store the email for the confirmation screen
      setResetEmail(email);
      
      // Switch to reset email sent mode
      setMode('reset-email-sent');
      
      // Reset form
      forgotPasswordForm.reset();
      
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Login' : 
               mode === 'signup' ? 'Sign Up' : 
               mode === 'forgot-password' ? 'Reset Password' :
               mode === 'reset-email-sent' ? 'Check Your Email' :
               'Check Your Email'}
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            {mode === 'login' 
              ? 'Enter your email and password to access your account' 
              : mode === 'signup'
              ? 'Create a new account to get started'
              : mode === 'forgot-password'
              ? 'Enter your email address and we\'ll send you a link to reset your password'
              : mode === 'reset-email-sent'
              ? `We've sent a password reset email to ${resetEmail}. Please check your inbox and click the link to reset your password.`
              : `We've sent a verification email to ${signupEmail}. Please check your inbox and click the verification link to complete your account setup.`
            }
          </p>

          {/* Login Form */}
          {mode === 'login' && (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !loginForm.formState.isValid}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </form>
            </Form>
          )}

          {/* Forgot Password Link */}
          {mode === 'login' && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setMode('forgot-password')}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot-password' && (
            <Form {...forgotPasswordForm}>
              <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                <FormField
                  control={forgotPasswordForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !forgotPasswordForm.formState.isValid}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Email
                </Button>
              </form>
            </Form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={signupForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="John"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Doe"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={signupForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signupForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signupForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Confirm your password"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !signupForm.formState.isValid}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </Form>
          )}

          {/* Email Verification Screen */}
          {(mode === 'email-sent' || mode === 'reset-email-sent') && (
            <div className="space-y-4">
              {/* Email icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  Check your spam folder if you don&apos;t see the email within a few minutes.
                </p>
                <p className="text-sm text-gray-600">
                  {mode === 'reset-email-sent' 
                    ? 'Click the link in the email to reset your password.'
                    : 'Once you verify your email, you can return to this page and sign in.'
                  }
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setMode('login');
                    if (onSuccess) {
                      onSuccess();
                    }
                    onClose();
                  }}
                  className="w-full"
                  variant="default"
                >
                  OK
                </Button>
                <Button
                  onClick={() => setMode(mode === 'reset-email-sent' ? 'forgot-password' : 'signup')}
                  className="w-full"
                  variant="outline"
                >
                  {mode === 'reset-email-sent' ? 'Back to Reset Password' : 'Back to Sign Up'}
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          {mode !== 'email-sent' && mode !== 'reset-email-sent' && (
            <div className="mt-6 text-center text-sm text-gray-600">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => setMode('signup')}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Sign up
                  </button>
                </>
              ) : mode === 'forgot-password' ? (
                <>
                  Remember your password?{" "}
                  <button
                    onClick={() => setMode('login')}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Back to Login
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => setMode('login')}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Legacy export for backward compatibility
export const LoginModal = AuthModal;