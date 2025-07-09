import Stripe from "stripe";
import { env } from "~/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
});

// Re-export the types and functions from subscription-db
export type { MinimalSubscriptionData, StripeSubscriptionData } from "./subscription-db";
export { 
  updateMinimalSubscriptionData, 
  getMinimalSubscriptionData, 
  clearSubscriptionData, 
  getUsersWithActiveSubscriptions, 
  checkSubscriptionFieldsExist,
  getPlanNameFromSubscriptionData 
} from "./subscription-db";

/**
 * Get plan name from Stripe Subscription object (for webhook usage)
 */
export async function getPlanNameFromStripeSubscription(subscription: Stripe.Subscription): Promise<string> {
  const priceId = subscription.items.data[0]?.price.id;
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
 * Helper to check if a plan has access to a specific feature
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