'use client';

import { Button } from '~/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { clientApi } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from 'react';

export function SubmitButton({ 
  priceId, 
  planName 
}: { 
  priceId?: string;
  planName: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  
  const createCheckoutSession = clientApi.payments.createCheckoutSession.useMutation({
    onSuccess: () => {
      toast.success(`Redirecting to checkout for ${planName}...`);
    },
    onError: (error) => {
      toast.error(`Failed to create checkout session: ${error.message}`);
      setIsLoading(false);
    },
  });

  const handleSubscribe = async () => {
    if (!priceId) {
      toast.error('Price ID is required');
      return;
    }

    setIsLoading(true);
    try {
      await createCheckoutSession.mutateAsync({ priceId });
    } catch (error) {
      // Error handling is done in the mutation callbacks
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSubscribe}
      disabled={isLoading || !priceId}
      className="w-full"
      variant={planName === 'Plus' ? 'default' : 'outline'}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Creating checkout...
        </>
      ) : (
        <>
          Get Started with {planName}
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
