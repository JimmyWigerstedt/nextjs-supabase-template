'use client';

import { useState, useEffect } from 'react';
import { Check, Crown, ChevronDown } from 'lucide-react';
import { BillingToggle, type BillingInterval } from '~/components/ui/billing-toggle';
import { SubmitButton } from './submit-button';
import { clientApi } from "~/trpc/react";
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

// Type definitions for better TypeScript support
interface StripePrice {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product: any; // Use any for flexibility with Stripe product types
  unit_amount: number | null;
  currency: string;
  interval: string | undefined;
  interval_count: number | undefined;
  metadata: Record<string, string>; // Include price metadata for credit display
}

interface Subscription {
  id: string;
  status: string;
  current_period_end: number;
  // Add other subscription properties as needed
}

export function PricingPageClient() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const searchParams = useSearchParams();
  
  const { data: prices, isLoading } = clientApi.payments.getStripePrices.useQuery();
  const { data: oneTimeProducts, isLoading: isLoadingOneTime } = clientApi.payments.getOneTimeProducts.useQuery();
  const { data: currentSubscription } = clientApi.payments.getCurrentSubscription.useQuery();

  // Show success message when redirected from successful checkout
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      const purchaseType = searchParams.get('type');
      if (purchaseType === 'one-time') {
        toast.success('🎉 Payment successful! Credits have been added to your account.');
      } else {
        toast.success('🎉 Payment successful! Your subscription is now active.');
      }
    }
  }, [searchParams]);

  if (isLoading || isLoadingOneTime) {
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
        <div className={`rounded-lg border-2 p-6 text-center ${
          currentSubscription.status === 'past_due' 
            ? 'border-yellow-500 bg-yellow-50' 
            : 'border-green-500 bg-green-50'
        }`}>
          <div className="flex items-center justify-center space-x-2">
            <Crown className={`h-5 w-5 ${
              currentSubscription.status === 'past_due' ? 'text-yellow-600' : 'text-green-600'
            }`} />
            <span className={`font-semibold ${
              currentSubscription.status === 'past_due' ? 'text-yellow-800' : 'text-green-800'
            }`}>
              {currentSubscription.status === 'past_due' 
                ? 'Payment issue - update payment' 
                : 'You have an active subscription'}
            </span>
          </div>
          <p className={`text-sm mt-2 ${
            currentSubscription.status === 'past_due' ? 'text-yellow-700' : 'text-green-700'
          }`}>
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

      {/* Credit Bundle Section */}
      {oneTimeProducts && oneTimeProducts.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Credit Bundles
            </h2>
            <p className="text-gray-600">
              Purchase credits anytime to top up your account
            </p>
          </div>
          
          <div className="max-w-md mx-auto">
            {oneTimeProducts.map((product) => (
              <CreditBundleCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
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

  // Extract usage credits from price metadata (not product metadata)
  const creditsMetadata = price.metadata?.usage_credits;
  const credits = parseInt(typeof creditsMetadata === 'string' ? creditsMetadata : '0', 10);
  // Handle invalid string values that result in NaN
  const validCredits = isNaN(credits) ? 0 : credits;
  const displayCredits = validCredits; // No multiplication needed - credits are already configured per price
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

interface OneTimeProduct {
  id: string;
  name: string;
  description: string | null;
  prices: {
    id: string;
    unit_amount: number | null;
    currency: string;
    metadata: Record<string, string>;
  }[];
}

interface CreditBundleCardProps {
  product: OneTimeProduct;
}

function CreditBundleCard({ product }: CreditBundleCardProps) {
  const [selectedPriceId, setSelectedPriceId] = useState<string>(() => {
    // Default to first price if available
    return product.prices.length > 0 ? product.prices[0]!.id : '';
  });
  const [isLoading, setIsLoading] = useState(false);

  const createOneTimeCheckout = clientApi.payments.createOneTimeCheckoutSession.useMutation({
    onSuccess: (data) => {
      toast.success('Redirecting to checkout...');
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to create checkout: ${error.message}`);
      setIsLoading(false);
    },
  });

  const selectedPrice = product.prices.find(p => p.id === selectedPriceId);
  const displayPrice = selectedPrice ? Math.floor((selectedPrice.unit_amount ?? 0) / 100) : 0;
  const credits = selectedPrice ? parseInt(selectedPrice.metadata?.usage_credits ?? '0', 10) : 0;
  const validCredits = isNaN(credits) ? 0 : credits;

  const handlePurchase = async () => {
    if (!selectedPriceId) {
      toast.error('Please select a credit bundle');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await createOneTimeCheckout.mutateAsync({ priceId: selectedPriceId });
    } catch (error) {
      // Error handling is done in the mutation callbacks
      console.error('Credit bundle purchase error:', error);
    }
  };

  if (product.prices.length === 0) {
    return null;
  }

  return (
    <div className="relative rounded-lg border-2 border-gray-200 bg-white p-8">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
        {product.description && (
          <p className="text-gray-600 mt-2">{product.description}</p>
        )}
      </div>

      {/* Price Selection Dropdown */}
      <div className="mb-6">
        <label htmlFor="price-select" className="block text-sm font-medium text-gray-700 mb-2">
          Choose your credit bundle:
        </label>
        <div className="relative">
          <select
            id="price-select"
            value={selectedPriceId}
            onChange={(e) => setSelectedPriceId(e.target.value)}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-4 py-3 pr-8 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {product.prices.map((price) => {
              const priceCredits = parseInt(price.metadata?.usage_credits ?? '0', 10);
              const validPriceCredits = isNaN(priceCredits) ? 0 : priceCredits;
              return (
                <option key={price.id} value={price.id}>
                  {validPriceCredits.toLocaleString()} credits
                </option>
              );
            })}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Price Display */}
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-gray-900">${displayPrice}</div>
        <div className="text-sm text-blue-600 font-medium mt-1">
          {validCredits > 0 && `${validCredits.toLocaleString()} credits`}
        </div>
        {validCredits > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            ${(displayPrice / validCredits).toFixed(3)} per credit
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8">
        <li className="flex items-start space-x-3">
          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-gray-700">Credits never expire</span>
        </li>
        <li className="flex items-start space-x-3">
          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-gray-700">Instant account top-up</span>
        </li>
        <li className="flex items-start space-x-3">
          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-gray-700">No subscription required</span>
        </li>
      </ul>

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={isLoading || !selectedPriceId}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Processing...' : 'Buy Credits'}
      </button>
    </div>
  );
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