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
 * Get plan name from StripeSubscriptionData
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
 * Get plan name from Stripe Subscription object (for webhook usage)
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
 * Helper to check if a plan has access to a specific feature
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
   * Get minimal local subscription data (just what we need for Stripe API calls)
   */
  async getLocalSubscriptionData(userId: string): Promise<MinimalSubscriptionData> {
    return await getMinimalSubscriptionData(userId);
  }

  /**
   * Fetch fresh subscription details from Stripe
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
   * Simple feature access check based on subscription plan
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
   * Create customer portal session for subscription management
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
   * Create or retrieve a Stripe customer for the user
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
   * Update local subscription data after webhook events
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
   * Format Stripe subscription data for consistent return type
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