'use client';

import { useState } from 'react';
import { Check, Crown } from 'lucide-react';
import { BillingToggle, type BillingInterval } from '~/components/ui/billing-toggle';
import { SubmitButton } from './submit-button';
import { clientApi } from "~/trpc/react";

// Type definitions for better TypeScript support
interface StripePrice {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product: any; // Use any for flexibility with Stripe product types
  unit_amount: number | null;
  currency: string;
  interval: string | undefined;
  interval_count: number | undefined;
}

interface Subscription {
  id: string;
  status: string;
  current_period_end: number;
  // Add other subscription properties as needed
}

export function PricingPageClient() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  
  const { data: prices, isLoading } = clientApi.payments.getStripePrices.useQuery();
  const { data: currentSubscription } = clientApi.payments.getCurrentSubscription.useQuery();

  if (isLoading) {
    return <PricingPageSkeleton />;
  }

  if (!prices) {
    return <div className="text-center text-gray-500">Unable to load pricing data</div>;
  }

  // Simple organization by interval
  const monthlyPrices = prices.filter((p) => p.interval === 'month');
  const yearlyPrices = prices.filter((p) => p.interval === 'year');
  const currentPrices = billingInterval === 'yearly' ? yearlyPrices : monthlyPrices;

  return (
    <div className="space-y-8">
      {/* Current Subscription Status */}
      {currentSubscription && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 p-6 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Crown className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-800">
              You have an active subscription
            </span>
          </div>
          <p className="text-sm text-green-700 mt-2">
            Use the &quot;Manage Subscription&quot; button to make changes
          </p>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="flex justify-center">
        <BillingToggle
          value={billingInterval}
          onChange={setBillingInterval}
        />
      </div>

      {/* Simple Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {currentPrices.map((price) => (
          <PricingCard
            key={price.id}
            price={price}
            billingInterval={billingInterval}
            currentSubscription={currentSubscription}
          />
        ))}
      </div>

      {/* Simple yearly savings message */}
      {billingInterval === 'yearly' && (
        <div className="text-center">
          <p className="text-sm text-green-600 font-medium">
            💰 Save with annual billing
          </p>
        </div>
      )}
    </div>
  );
}

interface PricingCardProps {
  price: StripePrice;
  billingInterval: BillingInterval;
  currentSubscription?: Subscription | null;
}

function PricingCard({ price }: PricingCardProps) {
  if (!price.unit_amount) {
    return null;
  }

  const displayPrice = Math.floor(price.unit_amount / 100);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const productName = price.product?.name ?? 'Unknown Plan';
  const displayInterval = price.interval ?? 'month';

  // Extract usage credits from product metadata
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const creditsMetadata = price.product?.metadata?.usage_credits;
  const baseCredits = parseInt(typeof creditsMetadata === 'string' ? creditsMetadata : '0', 10);
  // Handle invalid string values that result in NaN
  const validBaseCredits = isNaN(baseCredits) ? 0 : baseCredits;
  const displayCredits = price.interval === 'year' ? validBaseCredits * 12 : validBaseCredits;
  const creditsText = displayCredits > 0 ? 
    `${displayCredits.toLocaleString()} credits/${displayInterval}` : 
    'No credits included';

  // Simple features based on price tier
  const features = getSimpleFeatures(displayPrice);

  return (
    <div className="relative rounded-lg border-2 border-gray-200 bg-white p-8">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900">{productName}</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold text-gray-900">${displayPrice}</span>
          <span className="text-gray-600">/{displayInterval}</span>
        </div>
        {displayCredits > 0 && (
          <div className="mt-2 text-sm font-medium text-blue-600">
            {creditsText}
          </div>
        )}
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start space-x-3">
            <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
      <SubmitButton priceId={price.id} planName={productName} />
    </div>
  );
}

function getSimpleFeatures(price: number): string[] {
  // Simple feature mapping based on price tiers
  if (price < 20) {
    return [
      'Basic features',
      'Email support',
      'Limited usage',
      'Basic analytics',
    ];
  } else if (price < 50) {
    return [
      'All basic features',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'API access',
    ];
  } else {
    return [
      'All features included',
      'Premium support',
      'Advanced analytics',
      'Custom integrations',
      'API access',
      'White-label options',
    ];
  }
}

function PricingPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-2 border-gray-200 rounded-lg p-8 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-6"></div>
            <div className="h-8 bg-gray-200 rounded mb-8"></div>
            <div className="space-y-3 mb-8">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
} 