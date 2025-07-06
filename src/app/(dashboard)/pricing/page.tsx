import { Suspense } from 'react';
import { Check } from 'lucide-react';
import { SubmitButton } from './submit-button';
import { serverApi } from "~/trpc/server";

// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-600">
          Select the perfect plan for your needs
        </p>
      </div>
      
      <Suspense fallback={<PricingPageSkeleton />}>
        <PricingContent />
      </Suspense>
    </main>
  );
}

async function PricingContent() {
  const [prices, products] = await Promise.all([
    serverApi.payments.getStripePrices(),
    serverApi.payments.getStripeProducts(),
  ]);

  const basePlan = products.find((product) => product.name === 'Base');
  const plusPlan = products.find((product) => product.name === 'Plus');
  const premiumPlan = products.find((product) => product.name === 'Premium');

  const basePrice = prices.find((price) => price.productId === basePlan?.id);
  const plusPrice = prices.find((price) => price.productId === plusPlan?.id);
  const premiumPrice = prices.find((price) => price.productId === premiumPlan?.id);

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <PricingCard
        name={basePlan?.name || 'Base'}
        price={basePrice?.unitAmount || 800}
        interval={basePrice?.interval || 'month'}
        trialDays={basePrice?.trialPeriodDays || 7}
        features={[
          'Basic Features',
          'Email Support',
          'Standard Integrations',
          'Up to 5 Projects',
        ]}
        priceId={basePrice?.id}
        popular={false}
      />
      <PricingCard
        name={plusPlan?.name || 'Plus'}
        price={plusPrice?.unitAmount || 1200}
        interval={plusPrice?.interval || 'month'}
        trialDays={plusPrice?.trialPeriodDays || 7}
        features={[
          'Everything in Base',
          'Priority Support',
          'Advanced Integrations',
          'Up to 25 Projects',
          'Custom Workflows',
        ]}
        priceId={plusPrice?.id}
        popular={true}
      />
      <PricingCard
        name={premiumPlan?.name || 'Premium'}
        price={premiumPrice?.unitAmount || 2000}
        interval={premiumPrice?.interval || 'month'}
        trialDays={premiumPrice?.trialPeriodDays || 7}
        features={[
          'Everything in Plus',
          '24/7 Priority Support',
          'Premium Integrations',
          'Unlimited Projects',
          'Custom Development',
          'Dedicated Account Manager',
        ]}
        priceId={premiumPrice?.id}
        popular={false}
      />
    </div>
  );
}

function PricingCard({
  name,
  price,
  interval,
  trialDays,
  features,
  priceId,
  popular,
}: {
  name: string;
  price: number;
  interval: string;
  trialDays: number;
  features: string[];
  priceId?: string;
  popular: boolean;
}) {
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
      
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{name}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {trialDays} day free trial
        </p>
        <div className="mb-6">
          <span className="text-4xl font-bold text-gray-900">
            ${price ? Math.floor(price / 100) : 0}
          </span>
          <span className="text-lg text-gray-600 ml-1">
            / {interval}
          </span>
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
      
      <SubmitButton priceId={priceId} planName={name} />
    </div>
  );
}

function PricingPageSkeleton() {
  return (
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
  );
}
