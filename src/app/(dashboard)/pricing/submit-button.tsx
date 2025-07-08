'use client';

import { Button } from '~/components/ui/button';
import { ArrowRight, Loader2, Crown, Clock, RefreshCw } from 'lucide-react';
import { clientApi } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from 'react';
import type { BillingInterval } from '~/components/ui/billing-toggle';

type ButtonState = 
  | { type: 'current', label: string, disabled: true, subtitle?: string }
  | { type: 'upgrade', label: string, subtitle?: string, disabled?: boolean }
  | { type: 'downgrade', label: string, subtitle?: string, disabled?: boolean }
  | { type: 'switch_billing', label: string, subtitle?: string, disabled?: boolean }
  | { type: 'subscribe', label: string, subtitle?: string, disabled?: boolean }
  | { type: 'trial_active', label: string, disabled: true, subtitle?: string }
  | { type: 'reactivate', label: string, subtitle?: string, disabled?: boolean }
  | { type: 'manage', label: string, subtitle?: string, disabled?: boolean };

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
  
  // Get current subscription
  const { data: currentSubscription } = clientApi.payments.getCurrentSubscription.useQuery();
  
  // Get subscription comparison if we have a price ID
  const { data: comparison } = clientApi.payments.getSubscriptionComparison.useQuery(
    { targetPriceId: priceId! },
    { enabled: !!priceId }
  );

  const createCheckoutSession = clientApi.payments.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      const billingText = billingInterval === 'yearly' ? 'annual' : 'monthly';
      toast.success(`Redirecting to ${billingText} checkout for ${planName}...`);
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to create checkout session: ${error.message}`);
      setIsLoading(false);
    },
  });

  const upgradeSubscription = clientApi.payments.upgradeSubscription.useMutation({
    onSuccess: () => {
      toast.success(`Successfully upgraded to ${planName}!`);
      setIsLoading(false);
      // Refresh the page to update subscription status
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Failed to upgrade subscription: ${error.message}`);
      setIsLoading(false);
    },
  });

  const scheduleDowngrade = clientApi.payments.scheduleDowngrade.useMutation({
    onSuccess: () => {
      // Check if this was an interval change (which would be immediate)
      const isIntervalChange = comparison?.isSameProduct && !comparison?.isSameBillingCycle;
      
      if (isIntervalChange) {
        const billingText = billingInterval === 'yearly' ? 'annual' : 'monthly';
        toast.success(`Successfully switched to ${billingText} billing for ${planName}!`);
      } else {
        toast.success(`Downgrade to ${planName} scheduled for end of current period`);
      }
      
      setIsLoading(false);
      // Refresh the page to update subscription status
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Failed to process change: ${error.message}`);
      setIsLoading(false);
    },
  });

  const createCustomerPortal = clientApi.payments.createCustomerPortalSession.useMutation({
    onSuccess: (data) => {
      toast.success('Redirecting to customer portal...');
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to open customer portal: ${error.message}`);
      setIsLoading(false);
    },
  });

  // Determine button state based on subscription and comparison
  const determineButtonState = (): ButtonState => {
    if (!priceId) {
      return { type: 'subscribe', label: 'No Price Available', disabled: true };
    }

    // No subscription - show subscribe button
    if (!currentSubscription) {
      const billingText = billingInterval === 'yearly' ? 'Annual' : 'Monthly';
      return { 
        type: 'subscribe', 
        label: `Start ${billingText} Plan`,
        subtitle: '14-day free trial'
      };
    }

    // Trial active
    if (currentSubscription.subscriptionStatus === 'trialing') {
      if (comparison?.isSamePlan) {
        const trialEnd = currentSubscription.trialEnd ? new Date(currentSubscription.trialEnd) : null;
        const daysLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
        return { 
          type: 'trial_active', 
          label: `${daysLeft} days left in trial`, 
          disabled: true 
        };
      }
    }

    // Subscription cancelled - show reactivate
    if (currentSubscription.subscriptionStatus === 'canceled') {
      return { type: 'reactivate', label: 'Reactivate Plan' };
    }

    if (!comparison) {
      return { type: 'manage', label: 'Manage Subscription' };
    }

    // Same plan - show current
    if (comparison.isSamePlan) {
      return { type: 'current', label: 'Current Plan', disabled: true };
    }

    // Same product, different billing cycle
    if (comparison.isSameProduct && !comparison.isSameBillingCycle) {
      const targetInterval = billingInterval === 'yearly' ? 'Annual' : 'Monthly';
      const savings = comparison.priceDifference < 0 ? Math.abs(comparison.priceDifference) : 0;
      return { 
        type: 'switch_billing', 
        label: `Switch to ${targetInterval}`,
        subtitle: savings > 0 ? `Save $${savings}/mo` : undefined
      };
    }

    // Upgrade
    if (comparison.isUpgrade) {
      return { 
        type: 'upgrade', 
        label: 'Upgrade Now',
        subtitle: comparison.priceDifference > 0 ? `+$${comparison.priceDifference}/mo` : undefined
      };
    }

    // Downgrade
    if (comparison.isDowngrade) {
      // Check if this is actually an interval change
      const isIntervalChange = comparison.isSameProduct && !comparison.isSameBillingCycle;
      
      if (isIntervalChange) {
        const targetInterval = billingInterval === 'yearly' ? 'Annual' : 'Monthly';
        const savings = comparison.priceDifference < 0 ? Math.abs(comparison.priceDifference) : 0;
        return { 
          type: 'downgrade', 
          label: `Switch to ${targetInterval}`,
          subtitle: savings > 0 ? `Save $${savings}/mo` : undefined
        };
      } else {
        return { 
          type: 'downgrade', 
          label: 'Downgrade at Period End',
          subtitle: comparison.priceDifference < 0 ? `Save $${Math.abs(comparison.priceDifference)}/mo` : undefined
        };
      }
    }

    // Default to manage
    return { type: 'manage', label: 'Manage Subscription' };
  };

  const handleButtonClick = async () => {
    if (!priceId) {
      toast.error('Price ID is required');
      return;
    }

    setIsLoading(true);
    const buttonState = determineButtonState();

    try {
      switch (buttonState.type) {
        case 'subscribe':
        case 'reactivate':
          await createCheckoutSession.mutateAsync({ priceId });
          break;
        
        case 'upgrade':
        case 'switch_billing':
          await upgradeSubscription.mutateAsync({ 
            newPriceId: priceId,
            prorationBehavior: 'create_prorations' 
          });
          break;
        
        case 'downgrade':
          await scheduleDowngrade.mutateAsync({ newPriceId: priceId });
          break;
        
        case 'manage':
          await createCustomerPortal.mutateAsync();
          break;
        
        default:
          setIsLoading(false);
          break;
      }
    } catch (error) {
      // Error handling is done in the mutation callbacks
      setIsLoading(false);
    }
  };

  const buttonState = determineButtonState();

  const getButtonIcon = () => {
    switch (buttonState.type) {
      case 'current':
        return <Crown className="mr-2 h-4 w-4" />;
      case 'trial_active':
        return <Clock className="mr-2 h-4 w-4" />;
      case 'upgrade':
        return <ArrowRight className="ml-2 h-4 w-4" />;
      case 'switch_billing':
        return <RefreshCw className="ml-2 h-4 w-4" />;
      case 'manage':
        return <ArrowRight className="ml-2 h-4 w-4" />;
      default:
        return <ArrowRight className="ml-2 h-4 w-4" />;
    }
  };

  const getButtonVariant = () => {
    if (buttonState.type === 'current' || buttonState.type === 'trial_active') {
      return 'secondary';
    }
    if (buttonState.type === 'upgrade') {
      return 'default';
    }
    return planName === 'Plus' ? 'default' : 'outline';
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleButtonClick}
        disabled={isLoading || buttonState.disabled}
        className="w-full"
        variant={getButtonVariant()}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
            Processing...
          </>
        ) : (
          <>
            {buttonState.type === 'current' || buttonState.type === 'trial_active' ? (
              <>
                {getButtonIcon()}
                {buttonState.label}
              </>
            ) : (
              <>
                {buttonState.label}
                {getButtonIcon()}
              </>
            )}
          </>
        )}
      </Button>
      
      {buttonState.subtitle && (
        <p className="text-sm text-gray-600 text-center">
          {buttonState.subtitle}
        </p>
      )}
    </div>
  );
}
