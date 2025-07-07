'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { BillingToggle, BillingInterval } from '~/components/ui/billing-toggle';
import { SubmitButton } from './submit-button';
import { clientApi } from "~/trpc/react";
import type { OrganizedPrices, StripePrice } from '~/lib/payments/stripe';

export function PricingPageClient() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  
  const { data: organizedPrices, isLoading } = clientApi.payments.getOrganizedStripePrices.useQuery();

  if (isLoading) {
    return <PricingPageSkeleton />;
  }

  if (!organizedPrices) {
    return <div className="text-center text-gray-500">Unable to load pricing data</div>;
  }

  // Extract products in order (Base, Plus, Premium)
  const productOrder = ['Base', 'Plus', 'Premium'];
  const products = productOrder.map(name => {
    const productEntry = Object.entries(organizedPrices).find(([_, product]) => 
      product.productName === name
    );
    return productEntry ? { id: productEntry[0], ...productEntry[1] } : null;
  }).filter((product): product is NonNullable<typeof product> => product !== null);

  return (
    <div className="space-y-8">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <BillingToggle
          value={billingInterval}
          onChange={setBillingInterval}
        />
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {products.map((product, index) => (
          <PricingCard
            key={product.id}
            product={product}
            billingInterval={billingInterval}
            popular={product.productName === 'Plus'}
          />
        ))}
      </div>

      {/* Savings message */}
      {billingInterval === 'yearly' && (
        <div className="text-center">
          <p className="text-sm text-green-600 font-medium">
            💰 Save up to {Math.max(...products.map(p => p.savings || 0))}% with annual billing
          </p>
        </div>
      )}
    </div>
  );
}

interface PricingCardProps {
  product: {
    id: string;
    productName: string;
    monthly?: StripePrice;
    yearly?: StripePrice;
    savings?: number;
  };
  billingInterval: BillingInterval;
  popular: boolean;
}

function PricingCard({ product, billingInterval, popular }: PricingCardProps) {
  const currentPrice = billingInterval === 'yearly' ? product.yearly : product.monthly;
  const fallbackPrice = product.monthly || product.yearly;
  const price = currentPrice || fallbackPrice;

  if (!price) {
    return null;
  }

  // Calculate display price
  const displayPrice = price.unitAmount ? Math.floor(price.unitAmount / 100) : 0;
  const displayInterval = billingInterval === 'yearly' && price.interval === 'year' ? 'year' : 'month';
  
  // For yearly billing, show monthly equivalent
  const monthlyEquivalent = billingInterval === 'yearly' && price.interval === 'year' && price.unitAmount
    ? Math.floor(price.unitAmount / 100 / 12)
    : null;

  // Features for each plan
  const features = getFeatures(product.productName);

  return (
    <div className={`relative rounded-lg border-2 p-8 ${
      popular 
        ? 'border-blue-500 bg-blue-50' 
        : 'border-gray-200 bg-white'
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            Most Popular
          </span>
        </div>
      )}

      {/* Savings badge for yearly billing */}
      {billingInterval === 'yearly' && product.savings && product.savings > 0 && (
        <div className="absolute -top-3 -right-3">
          <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
            Save {product.savings}%
          </span>
        </div>
      )}
      
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.productName}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {price.trialPeriodDays || 7} day free trial
        </p>
        <div className="mb-6">
          {billingInterval === 'yearly' && monthlyEquivalent ? (
            <div>
              <span className="text-4xl font-bold text-gray-900">
                ${monthlyEquivalent}
              </span>
              <span className="text-lg text-gray-600 ml-1">
                /month
              </span>
              <div className="text-sm text-gray-500">
                billed annually (${displayPrice}/year)
              </div>
            </div>
          ) : (
            <div>
              <span className="text-4xl font-bold text-gray-900">
                ${displayPrice}
              </span>
              <span className="text-lg text-gray-600 ml-1">
                / {displayInterval}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      
      <SubmitButton 
        priceId={price.id} 
        planName={product.productName}
        billingInterval={billingInterval}
      />
    </div>
  );
}

function getFeatures(planName: string): string[] {
  const features: Record<string, string[]> = {
    'Base': [
      'Basic Features',
      'Email Support',
      'Standard Integrations',
      'Up to 5 Projects',
    ],
    'Plus': [
      'Everything in Base',
      'Priority Support',
      'Advanced Integrations',
      'Up to 25 Projects',
      'Custom Workflows',
    ],
    'Premium': [
      'Everything in Plus',
      '24/7 Priority Support',
      'Premium Integrations',
      'Unlimited Projects',
      'Custom Development',
      'Dedicated Account Manager',
    ],
  };

  return features[planName] || [];
}

function PricingPageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Toggle skeleton */}
      <div className="flex justify-center">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
      
      {/* Cards skeleton */}
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