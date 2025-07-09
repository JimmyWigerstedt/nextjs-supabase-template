import { env } from "~/env";
import Stripe from "stripe";
import { 
  type MinimalSubscriptionData, 
  type StripeSubscriptionData,
  updateMinimalSubscriptionData,
  getMinimalSubscriptionData
} from "./subscription-db";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
});

/**
 * Resolve product name from StripeSubscriptionData by fetching price and product details from Stripe API
 * 
 * Implementation notes: Makes two API calls (price retrieve + product retrieve) to resolve plan name
 * Used by: Feature access control and subscription display logic
 */
async function getPlanNameFromSubscriptionData(subscription: StripeSubscriptionData): Promise<string> {
  const priceId = subscription.items[0]?.price_id;
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
 * Resolve product name from Stripe Subscription object (webhook event handling)
 * 
 * Implementation notes: Makes two API calls (price retrieve + product retrieve) to resolve plan name
 * Used by: Webhook synchronization to update local cache with plan names
 */
async function getPlanNameFromStripeSubscription(subscription: Stripe.Subscription): Promise<string> {
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
 * Feature access control lookup with plan-based permission mapping
 * 
 * Implementation notes: Static mapping of plan names to feature arrays
 * Used by: Authorization checks throughout the application
 */
function checkFeatureAccess(planName: string, feature: string): boolean {
  const featureMap: Record<string, string[]> = {
    'free': ['basic_features'],
    'pro': ['basic_features', 'advanced_features'],
    'enterprise': ['basic_features', 'advanced_features', 'enterprise_features'],
  };

  const planFeatures = featureMap[planName.toLowerCase()] ?? [];
  return planFeatures.includes(feature);
}

export class SubscriptionService {
  /**
   * Retrieve cached subscription metadata from local database
   * 
   * Implementation notes: Database query to userData table for Stripe identifiers and plan info
   * Used by: All subscription operations as first step in cache-first strategy
   */
  async getLocalSubscriptionData(userId: string): Promise<MinimalSubscriptionData> {
    return await getMinimalSubscriptionData(userId);
  }

  /**
   * Get active subscription using cache-first strategy with Stripe API fallback
   * 
   * Implementation notes: Complex multi-step process:
   * 1. Check local cache for subscription_id
   * 2. If found, direct Stripe API lookup
   * 3. If missing, search customer's active subscriptions
   * 4. Update local cache with discovered subscription
   * Used by: Subscription display, billing portal, feature access checks
   */
  async getActiveSubscription(userId: string): Promise<StripeSubscriptionData | null> {
    const localData = await this.getLocalSubscriptionData(userId);
    
    if (!localData.stripe_customer_id) {
      return null;
    }

    try {
      // If we have a subscription ID, fetch it directly
      if (localData.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.retrieve(localData.stripe_subscription_id);
        return this.formatSubscriptionData(subscription);
      }

      // Otherwise, find active subscriptions for the customer
      const subscriptions = await stripe.subscriptions.list({
        customer: localData.stripe_customer_id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        
        if (subscription) {
          // Update local data with the found subscription
          await updateMinimalSubscriptionData(userId, {
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
          });

          return this.formatSubscriptionData(subscription);
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch subscription from Stripe:', error);
      return null;
    }
  }

  /**
   * Feature access check with cache-first strategy and automatic plan resolution
   * 
   * Implementation notes: Checks local plan first, falls back to Stripe API if missing,
   * includes automatic plan name resolution and cache updates
   * Used by: Authorization middleware, UI conditional rendering
   */
  async hasFeature(userId: string, feature: string): Promise<boolean> {
    const localData = await this.getLocalSubscriptionData(userId);
    
    // If no subscription data, check Stripe
    if (!localData.subscription_plan) {
      const subscription = await this.getActiveSubscription(userId);
      if (!subscription) return false;
      
      // Update local data with plan from Stripe using the correct method
      const planName = await getPlanNameFromSubscriptionData(subscription);
      await updateMinimalSubscriptionData(userId, {
        subscription_plan: planName,
      });
      
      return checkFeatureAccess(planName, feature);
    }

    return checkFeatureAccess(localData.subscription_plan, feature);
  }

  /**
   * Create Stripe customer portal session for subscription management
   * 
   * Implementation notes: Always creates fresh portal session from Stripe (no caching)
   * Used by: Subscription management UI, billing page redirects
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    const localData = await this.getLocalSubscriptionData(userId);
    
    if (!localData.stripe_customer_id) {
      throw new Error('No Stripe customer found for user');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: localData.stripe_customer_id,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * Ensure Stripe customer exists, creating if necessary with local cache update
   * 
   * Implementation notes: Checks local cache first, creates new customer if missing,
   * automatically updates local cache with customer_id
   * Used by: Checkout flow, customer portal creation
   */
  async ensureStripeCustomer(userId: string, email: string): Promise<string> {
    const localData = await this.getLocalSubscriptionData(userId);
    
    if (localData.stripe_customer_id) {
      return localData.stripe_customer_id;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        user_id: userId,
      },
    });

    // Update local data
    await updateMinimalSubscriptionData(userId, {
      stripe_customer_id: customer.id,
    });

    return customer.id;
  }

  /**
   * Synchronize local subscription cache from Stripe webhook events
   * 
   * Implementation notes: Resolves plan name via product API calls and updates
   * comprehensive local metadata (customer_id, subscription_id, plan, status)
   * Used by: Webhook event handlers for real-time sync
   */
  async syncSubscriptionFromWebhook(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.user_id;
    if (!userId) {
      console.error('No user_id in subscription metadata');
      return;
    }

    // Use the correct method for Stripe Subscription objects
    const planName = await getPlanNameFromStripeSubscription(subscription);

    await updateMinimalSubscriptionData(userId, {
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      subscription_plan: planName,
      subscription_status: subscription.status,
    });
  }

  /**
   * Transform Stripe Subscription object to internal StripeSubscriptionData format
   * 
   * Implementation notes: Handles type assertion and data extraction from Stripe objects
   * Used by: Internal data formatting for consistent return types
   */
  private formatSubscriptionData(subscription: Stripe.Subscription): StripeSubscriptionData {
    // Use type assertion for properties that might have type issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const sub = subscription as any;
    
    return {
      id: subscription.id,
      customer: subscription.customer as string,
      status: subscription.status,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      current_period_start: sub.current_period_start,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      current_period_end: sub.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: subscription.trial_end,
      items: subscription.items.data.map(item => ({
        price_id: item.price.id,
        product_id: typeof item.price.product === 'string' 
          ? item.price.product 
          : item.price.product.id,
      })),
    };
  }
}

// Export a singleton instance
export const subscriptionService = new SubscriptionService(); 