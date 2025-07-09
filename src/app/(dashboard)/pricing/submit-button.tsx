'use client';

import { Button } from '~/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { clientApi } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from 'react';

export function SubmitButton({ 
  priceId, 
  planName,
}: { 
  priceId?: string;
  planName: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  
  const { data: subscription } = clientApi.payments.getCurrentSubscription.useQuery();
  
  const createCheckout = clientApi.payments.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      toast.success(`Redirecting to checkout for ${planName}...`);
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to create checkout: ${error.message}`);
      setIsLoading(false);
    },
  });
  
  const createPortal = clientApi.payments.createCustomerPortalSession.useMutation({
    onSuccess: (data) => {
      toast.success('Opening customer portal...');
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to open portal: ${error.message}`);
      setIsLoading(false);
    },
  });
  
  // Simple logic: Has subscription? → Portal. No subscription? → Checkout.
  const handleClick = async () => {
    if (!priceId) {
      toast.error('Price not available');
      return;
    }

    setIsLoading(true);
    
    try {
      if (subscription) {
        await createPortal.mutateAsync();
      } else {
        await createCheckout.mutateAsync({ priceId });
      }
    } catch (error) {
      // Error handling is done in the mutation callbacks
      console.error('Button click error:', error);
    }
  };
  
  const buttonText = subscription ? 'Manage Subscription' : 'Subscribe';
  const buttonIcon = subscription ? <ArrowRight className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />;
  
  return (
    <Button 
      onClick={handleClick} 
      disabled={isLoading || !priceId}
      className="w-full"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {buttonText}
          {buttonIcon}
        </>
      )}
    </Button>
  );
}
