import type Stripe from "stripe";
import { 
  type MinimalSubscriptionData, 
  type StripeSubscriptionData,
  updateMinimalSubscriptionData,
  getMinimalSubscriptionData
} from "./subscription-db";
import {
  getPlanNameFromSubscriptionData,
  getPlanNameFromStripeSubscription,
  checkFeatureAccess
} from "./stripe-product-utils";
import { stripe } from "./payments/stripe";

export class SubscriptionService {
  /**
   * In-memory cache to track processed invoice IDs for idempotency
   * 
   * Implementation notes: Simple Set-based cache to prevent duplicate processing
   * during webhook retries. In production, consider using Redis or database.
   */
  private processedInvoices = new Set<string>();

  /**
   * Check if invoice has already been processed
   * 
   * Implementation notes: Used to prevent duplicate credit allocation during webhook retries
   */
  async isInvoiceProcessed(invoiceId: string): Promise<boolean> {
    return this.processedInvoices.has(invoiceId);
  }

  /**
   * Mark invoice as processed for idempotency
   * 
   * Implementation notes: Adds invoice ID to processed set to prevent duplicate processing
   */
  async markInvoiceProcessed(invoiceId: string): Promise<void> {
    this.processedInvoices.add(invoiceId);
    console.log(`[credits] Marked invoice ${invoiceId} as processed`);
  }

  /**
   * Define subscription statuses that should be considered "active" for UI purposes
   * 
   * Implementation notes: These statuses should show a subscription banner in the UI
   * Used by: getActiveSubscription() to filter out ended subscriptions
   */
  private getUIActiveStatuses(): string[] {
    return ['active', 'trialing', 'past_due'];
  }

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
   * 2. If found, direct Stripe API lookup (filtered by UI-active statuses)
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
        
        // Filter out ended subscriptions - only return UI-active statuses
        if (!this.getUIActiveStatuses().includes(subscription.status)) {
          return null;
        }
        
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
   * subscription metadata (customer_id, subscription_id, plan, status) WITHOUT
   * credit allocation. Credits are now handled by invoice.payment_succeeded webhook.
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
    
    console.log(`[webhook] Syncing subscription ${subscription.id} for user ${userId} (plan: ${planName})`);

    await updateMinimalSubscriptionData(userId, {
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      subscription_plan: planName,
      subscription_status: subscription.status,
      // NOTE: usage_credits are NOT updated here - handled by invoice.payment_succeeded
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

  /**
   * Calculate credits from current subscription state (not invoice line items)
   * 
   * Implementation notes: Fetches current subscription state from Stripe to get credits
   * from price-level metadata. This approach handles mid-cycle upgrades reliably since
   * upgrade invoices contain proration line items without usage_credits metadata.
   * Used by: Invoice payment processing for payment-first credit allocation
   */
  async calculateCreditsFromInvoice(invoice: Stripe.Invoice): Promise<number> {
    console.log(`[credits] Calculating credits from invoice ${invoice.id}`);
    
    try {
      // Extract subscription ID from invoice
      const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string }).subscription;
      if (!subscriptionId) {
        console.log(`[credits] Invoice ${invoice.id} has no subscription ID`);
        return 0;
      }
      
      console.log(`[credits] Fetching subscription ${subscriptionId} to get current state`);
      
      // Fetch current subscription with expanded price data
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      });
      
      console.log(`[credits] Subscription ${subscriptionId} has ${subscription.items.data.length} items`);
      
      // Sum credits from all subscription items
      let totalCredits = 0;
      
      for (const item of subscription.items.data) {
        const price = item.price;
        const usageCreditsStr = price.metadata?.usage_credits;
        
        if (!usageCreditsStr) {
          console.log(`[credits] Price ${price.id} has no usage_credits metadata, skipping`);
          continue;
        }
        
        const itemCredits = parseInt(usageCreditsStr, 10);
        if (isNaN(itemCredits) || itemCredits <= 0) {
          console.log(`[credits] Price ${price.id} has invalid usage_credits metadata: ${usageCreditsStr}`);
          continue;
        }
        
        totalCredits += itemCredits;
        console.log(`[credits] Price ${price.id}: ${itemCredits} credits (product: ${typeof price.product === 'string' ? price.product : price.product.id})`);
      }
      
      console.log(`[credits] Total calculated credits from subscription ${subscriptionId}: ${totalCredits}`);
      return totalCredits;
      
    } catch (error) {
      console.error(`[credits] Error calculating credits from invoice ${invoice.id}:`, error);
      
      // Don't throw error - return 0 to prevent webhook failure
      // This allows the webhook to continue processing other events
      console.log(`[credits] Returning 0 credits due to error - webhook will continue`);
      return 0;
    }
  }

  /**
   * Handle credit allocation based on invoice billing reason
   * 
   * Implementation notes: Uses billing_reason to determine whether to ADD or REPLACE credits.
   * Implements payment-first credit allocation strategy.
   * Used by: Invoice payment webhook processing
   */
  async handleCreditAllocation(billingReason: string, userId: string, credits: number): Promise<void> {
    const { setUserCredits, addUserCredits } = await import('./subscription-db');
    
    console.log(`[credits] Handling credit allocation: ${billingReason}, user: ${userId}, credits: ${credits}`);
    
    switch (billingReason) {
      case 'subscription_cycle':
        // Regular renewal - REPLACE credits (fresh billing period)
        await setUserCredits(userId, credits);
        console.log(`[credits] Renewal: Set user ${userId} credits to ${credits}`);
        break;
        
      case 'subscription_update':
        // Plan change - ADD credits (prorated amount)
        await addUserCredits(userId, credits);
        console.log(`[credits] Plan change: Added ${credits} credits to user ${userId}`);
        break;
        
      case 'subscription_create':
        // Initial signup - SET credits
        await setUserCredits(userId, credits);
        console.log(`[credits] Initial signup: Set user ${userId} credits to ${credits}`);
        break;
        
      case 'manual':
        // Add-on purchase - ADD credits
        await addUserCredits(userId, credits);
        console.log(`[credits] Add-on purchase: Added ${credits} credits to user ${userId}`);
        break;
        
      default:
        console.log(`[credits] Unknown billing reason: ${billingReason}, defaulting to ADD credits`);
        await addUserCredits(userId, credits);
        break;
    }
  }

  /**
   * Extract user ID from invoice using correct Stripe invoice structure
   * 
   * Implementation notes: Uses correct Stripe invoice structure to find user_id:
   * 1. Check invoice.parent.subscription_details.metadata (most reliable for subscription invoices)
   * 2. Check line item parent.subscription_details.metadata for subscription line items
   * 3. Fallback to API call to subscription metadata (last resort)
   * Used by: Invoice payment processing to identify the user
   */
  async extractUserIdFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
    try {
      // FIRST: Check invoice parent subscription_details metadata (most reliable for subscription invoices)
      const invoiceWithParent = invoice as Stripe.Invoice & {
        parent?: { 
          subscription_details?: { metadata?: { user_id?: string } };
        };
      };
      
      if (invoiceWithParent.parent?.subscription_details?.metadata?.user_id) {
        console.log(`[credits] Found user_id in invoice.parent.subscription_details.metadata: ${invoiceWithParent.parent.subscription_details.metadata.user_id}`);
        return invoiceWithParent.parent.subscription_details.metadata.user_id;
      }

      // SECOND: Check line item parent subscription_details metadata
      for (const lineItem of invoice.lines.data) {
        const lineItemWithParent = lineItem as Stripe.InvoiceLineItem & {
          parent?: {
            subscription_details?: { metadata?: { user_id?: string } };
          };
        };
        
        if (lineItemWithParent.parent?.subscription_details?.metadata?.user_id) {
          console.log(`[credits] Found user_id in line item parent.subscription_details.metadata: ${lineItemWithParent.parent.subscription_details.metadata.user_id}`);
          return lineItemWithParent.parent.subscription_details.metadata.user_id;
        }
      }

      // THIRD: Check direct line item metadata (for subscription line items)
      for (const lineItem of invoice.lines.data) {
        if (lineItem.metadata?.user_id) {
          console.log(`[credits] Found user_id in line item metadata: ${lineItem.metadata.user_id}`);
          return lineItem.metadata.user_id;
        }
      }
      
      // FOURTH: Fallback to API call (existing behavior)
      console.log(`[credits] No user_id found in invoice payload, falling back to API call`);
      const invoiceWithSubscription = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription;
      };
      
      const subscriptionId = typeof invoiceWithSubscription.subscription === 'string' 
        ? invoiceWithSubscription.subscription 
        : invoiceWithSubscription.subscription?.id;
        
      if (!subscriptionId) {
        console.log(`[credits] Invoice ${invoice.id} has no subscription`);
        return null;
      }
      
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata.user_id;
      
      if (!userId) {
        console.error(`[credits] No user_id found in subscription ${subscription.id} metadata`);
        return null;
      }
      
      console.log(`[credits] Found user_id via API call: ${userId}`);
      return userId;
    } catch (error) {
      console.error(`[credits] Error extracting user ID from invoice ${invoice.id}:`, error);
      return null;
    }
  }
}

// Export a singleton instance
export const subscriptionService = new SubscriptionService(); 