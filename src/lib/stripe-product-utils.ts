import type Stripe from "stripe";
import type { StripeSubscriptionData } from "./subscription-db";
import { stripe } from "./payments/stripe";

/**
 * Core utility to resolve product name from Stripe price ID
 * 
 * Implementation notes: Makes two API calls (price retrieve + product retrieve) to resolve plan name
 * Used by: All subscription product name resolution functions
 */
export async function resolveProductNameFromPrice(priceId: string | undefined): Promise<string> {
  if (!priceId) return 'unknown';

  try {
    const price = await stripe.prices.retrieve(priceId);
    const productId = typeof price.product === 'string' 
      ? price.product 
      : price.product.id;
    
    const product = await stripe.products.retrieve(productId);
    return product.name.toLowerCase();
  } catch (error) {
    console.error('Failed to get product name:', error);
    return 'unknown';
  }
}

/**
 * Resolve product name from StripeSubscriptionData by fetching price and product details from Stripe API
 * 
 * Implementation notes: Extracts price ID from subscription data and resolves product name
 * Used by: Feature access control and subscription display logic
 */
export async function getPlanNameFromSubscriptionData(subscription: StripeSubscriptionData): Promise<string> {
  const priceId = subscription.items[0]?.price_id;
  return await resolveProductNameFromPrice(priceId);
}

/**
 * Resolve product name from Stripe Subscription object (webhook event handling)
 * 
 * Implementation notes: Extracts price ID from Stripe subscription object and resolves product name
 * Used by: Webhook synchronization to update local cache with plan names
 */
export async function getPlanNameFromStripeSubscription(subscription: Stripe.Subscription): Promise<string> {
  const priceId = subscription.items.data[0]?.price.id;
  return await resolveProductNameFromPrice(priceId);
}

/**
 * Feature access control lookup with plan-based permission mapping
 * 
 * Implementation notes: Static mapping of plan names to feature arrays
 * Used by: Authorization checks throughout the application
 */
export function checkFeatureAccess(planName: string, feature: string): boolean {
  const featureMap: Record<string, string[]> = {
    'free': ['basic_features'],
    'pro': ['basic_features', 'advanced_features'],
    'enterprise': ['basic_features', 'advanced_features', 'enterprise_features'],
  };

  const planFeatures = featureMap[planName.toLowerCase()] ?? [];
  return planFeatures.includes(feature);
} 