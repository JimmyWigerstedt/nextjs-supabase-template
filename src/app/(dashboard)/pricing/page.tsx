import { Suspense } from 'react';
import { PricingPageClient } from './pricing-client';
import { AppHeader } from '~/components/layout/AppHeader';

// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Header */}
      <AppHeader 
        currentPage="Pricing"
      />
      
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
          <PricingPageClient />
        </Suspense>
      </main>
    </div>
  );
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
