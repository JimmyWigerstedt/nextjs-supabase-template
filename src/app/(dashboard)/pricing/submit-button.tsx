'use client';

import { Button } from '~/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { clientApi } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from 'react';
import type { BillingInterval } from '~/components/ui/billing-toggle';

export function SubmitButton({ 
  priceId, 
  planName,
  billingInterval = 'monthly'
}: { 
  priceId?: string;
  planName: string;
  billingInterval?: BillingInterval;
}) {
  const [isLoading, setIsLoading] = useState(false);
  
  const createCheckoutSession = clientApi.payments.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      const billingText = billingInterval === 'yearly' ? 'annual' : 'monthly';
      toast.success(`Redirecting to ${billingText} checkout for ${planName}...`);
      // Redirect to Stripe checkout
      window.location.href = data.url;
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

  // Dynamic button text based on billing interval
  const getButtonText = () => {
    const billingText = billingInterval === 'yearly' ? 'Annual' : 'Monthly';
    return `Start ${billingText} Plan`;
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
          {getButtonText()}
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
