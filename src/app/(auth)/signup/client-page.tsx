"use client";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { supabaseBrowser } from "~/util/supabase/browser";

const signupFormSchema = z
  .object({
    email: z.string().email(),
    password1: z.string().min(8, "Must be at least 8 characters"),
    password2: z.string().min(8, "Must be at least 8 characters"),

    // could ask for a username if you wanted to, too
    // username: z.string().min(5),

    firstName: z.string(),
    lastName: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password1 !== data.password2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password2"],
        message: "Passwords don't match",
      });
    }
  });

export function SignupClientPage() {
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState<string>('');

  const form = useForm<z.infer<typeof signupFormSchema>>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      email: "",
      password1: "",
      password2: "",
    },
  });

  const onSubmit: Parameters<typeof form.handleSubmit>[0] = async (data) => {
    const { email, password1: password, firstName, lastName } = data;

    const supabase = supabaseBrowser();

    const emailRedirectTo = `${window.location.href}/confirm-signup`;

    const signupResponse = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          firstName,
          lastName,
        },
      },
    });

    if (signupResponse.error) {
      toast.error(`Error signing up - ${signupResponse.error.message}`);
      throw signupResponse.error;
    }

    if (!signupResponse.data.user?.id) {
      const message = `Error signing up. That email might be taken already.`;
      toast.error(message);
      throw new Error(message);
    }

    // Store the email and show email sent screen
    setSignupEmail(email);
    setShowEmailSent(true);
  };

  if (showEmailSent) {
    return (
      <div className="col-span-12 flex flex-col items-center p-2 pt-8 md:col-span-6 md:col-start-4 lg:col-span-4 lg:col-start-5 2xl:col-span-2 2xl:col-start-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl text-center">Check Your Email</CardTitle>
            <CardDescription className="text-center">
              We&apos;ve sent a verification email to <strong>{signupEmail}</strong>.
              Please check your inbox and click the verification link to complete your account setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Email icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            <div className="text-center space-y-2 mb-6">
              <p className="text-sm text-gray-600">
                Check your spam folder if you don&apos;t see the email within a few minutes.
              </p>
              <p className="text-sm text-gray-600">
                Once you verify your email, you can return and sign in.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex w-full flex-col gap-4 text-center text-sm">
              <Link href="/login">
                <Button className="w-full">
                  OK
                </Button>
              </Link>
              <Button
                onClick={() => setShowEmailSent(false)}
                variant="outline"
                className="w-full"
              >
                Back to Sign Up
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="col-span-12 flex flex-col items-center p-2 pt-8 md:col-span-6 md:col-start-4 lg:col-span-4 lg:col-start-5 2xl:col-span-2 2xl:col-start-6">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Form {...form}>
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-xl">Sign Up</CardTitle>
              <CardDescription>
                Enter your information to create an account. You&apos;ll have to
                confirm your email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} required placeholder="John" />
                          </FormControl>
                          <FormDescription />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} required placeholder="Doe" />
                          </FormControl>
                          <FormDescription />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            required
                            placeholder="example@gmail.com"
                          />
                        </FormControl>
                        <FormDescription />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* <div className="grid gap-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            required
                            placeholder="john_doe123"
                          />
                        </FormControl>
                        <FormDescription />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div> */}
                <div className="grid gap-2">
                  <FormField
                    control={form.control}
                    name="password1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" required />
                        </FormControl>
                        <FormDescription />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-2">
                  <FormField
                    control={form.control}
                    name="password2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" required />
                        </FormControl>
                        <FormDescription />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex w-full flex-col gap-4 text-center text-sm">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    !form.formState.isValid ||
                    form.formState.isSubmitting ||
                    form.formState.isSubmitSuccessful
                  }
                >
                  {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {form.formState.isSubmitSuccessful
                    ? "Check your email"
                    : "Create an account"}
                </Button>
                <div>
                  Already have an account?{" "}
                  <Link href="/login" className="underline">
                    Sign in
                  </Link>
                </div>
              </div>
            </CardFooter>
          </Card>
        </Form>
      </form>
    </div>
  );
}
