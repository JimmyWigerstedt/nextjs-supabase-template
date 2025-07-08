import type Stripe from 'stripe';
import { stripe } from './stripe';
import { internalDb } from '~/server/internal-db';
import { env } from '~/env';
import { 
  extractSubscriptionTimestamps, 
  validateTimestamps, 
  formatTimestampsForDatabase,
  type SubscriptionTimestamps 
} from './stripe-utils';

// Type for user data from database
export type UserData = {
  UID: string;
  created_at?: string;
  updated_at?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planName?: string;
  subscriptionStatus?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEnd?: string;
  cancelAtPeriodEnd?: boolean;
  priceId?: string;
} & Record<string, string | undefined>;

/**
 * Base class for subscription handlers with shared functionality
 */
export abstract class BaseSubscriptionHandler {
  protected async getUserByCustomerId(customerId: string): Promise<UserData | null> {
    const client = await internalDb.connect();
    try {
      const result = await client.query(
        `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "stripeCustomerId" = $1`,
        [customerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as UserData;
    } finally {
      client.release();
    }
  }

  protected async getProductName(productId: string): Promise<string> {
    try {
      const product = await stripe.products.retrieve(productId);
      return product.name || 'Unknown Plan';
    } catch (error) {
      console.error(`[BaseSubscriptionHandler] ⚠️ Failed to fetch product ${productId}:`, error);
      return 'Unknown Plan';
    }
  }

  protected validateSubscriptionData(subscription: Stripe.Subscription): void {
    const subscriptionId = subscription.id;
    const customerId = subscription.customer as string;

    if (!customerId || !subscriptionId) {
      console.error(`[BaseSubscriptionHandler] ❌ Missing required data: customerId=${customerId}, subscriptionId=${subscriptionId}`);
      throw new Error('Missing required subscription data');
    }

    // Validate subscription items exist for active/trialing subscriptions
    if ((subscription.status === 'active' || subscription.status === 'trialing') &&
        (!subscription.items?.data || subscription.items.data.length === 0)) {
      console.error(`[BaseSubscriptionHandler] ❌ No subscription items found for subscription ${subscriptionId}`);
      throw new Error('Subscription has no items');
    }
  }

  protected getPriceFromSubscription(subscription: Stripe.Subscription): Stripe.Price {
    const plan = subscription.items.data[0]?.price;
    if (!plan) {
      console.error(`[BaseSubscriptionHandler] ❌ No price found in subscription items for ${subscription.id}`);
      throw new Error('Subscription item has no price');
    }
    return plan;
  }

  abstract handle(subscription: Stripe.Subscription, userData: UserData): Promise<void>;
}

/**
 * Handler for active subscriptions
 */
export class ActiveSubscriptionHandler extends BaseSubscriptionHandler {
  async handle(subscription: Stripe.Subscription, userData: UserData): Promise<void> {
    const subscriptionId = subscription.id;
    const status = subscription.status;
    
    console.log(`[ActiveSubscriptionHandler] Processing active subscription ${subscriptionId} for user ${userData.UID}`);
    
    this.validateSubscriptionData(subscription);
    const plan = this.getPriceFromSubscription(subscription);
    
    // Get product information
    let productName = 'Unknown Plan';
    if (typeof plan.product === 'string') {
      console.log(`[ActiveSubscriptionHandler] 🔄 Fetching product details for ${plan.product}`);
      productName = await this.getProductName(plan.product);
    } else if (plan.product && 'name' in plan.product) {
      productName = plan.product.name || 'Unknown Plan';
    }
    
    // Extract and validate timestamps
    const timestamps = extractSubscriptionTimestamps(subscription);
    const validation = validateTimestamps(timestamps, status);
    
    if (validation.warnings.length > 0) {
      console.warn(`[ActiveSubscriptionHandler] Timestamp warnings for ${subscriptionId}:`, validation.warnings);
    }
    
    if (!validation.isValid) {
      console.error(`[ActiveSubscriptionHandler] ❌ Invalid timestamps for subscription ${subscriptionId}:`, validation.errors);
      throw new Error(`Invalid subscription timestamps: ${validation.errors.join(', ')}`);
    }
    
    console.log(`[ActiveSubscriptionHandler] Processed timestamps:`, {
      status,
      currentPeriodStart: timestamps.currentPeriodStart?.toISOString() ?? 'null',
      currentPeriodEnd: timestamps.currentPeriodEnd?.toISOString() ?? 'null',
      trialEnd: timestamps.trialEnd?.toISOString() ?? 'null',
      cancelAtPeriodEnd: timestamps.cancelAtPeriodEnd
    });
    
    // Update database
    await this.updateUserSubscription(userData, subscriptionId, productName, status, plan.id, timestamps);
  }

  private async updateUserSubscription(
    userData: UserData,
    subscriptionId: string,
    productName: string,
    status: string,
    priceId: string,
    timestamps: SubscriptionTimestamps
  ): Promise<void> {
    const client = await internalDb.connect();
    try {
      const dbTimestamps = formatTimestampsForDatabase(timestamps);
      
      console.log(`[ActiveSubscriptionHandler] Database params:`, {
        subscriptionId,
        productName,
        status,
        priceId,
        currentPeriodStart: dbTimestamps.currentPeriodStart,
        currentPeriodEnd: dbTimestamps.currentPeriodEnd,
        trialEnd: dbTimestamps.trialEnd,
        cancelAtPeriodEnd: dbTimestamps.cancelAtPeriodEnd,
        userId: userData.UID
      });
      
      const result = await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" 
         SET "stripeSubscriptionId" = $1, 
             "planName" = $2,
             "subscriptionStatus" = $3,
             "priceId" = $4,
             "currentPeriodStart" = $5,
             "currentPeriodEnd" = $6,
             "trialEnd" = $7,
             "cancelAtPeriodEnd" = $8,
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "UID" = $9`,
        [
          subscriptionId, 
          productName, 
          status, 
          priceId,
          dbTimestamps.currentPeriodStart,
          dbTimestamps.currentPeriodEnd,
          dbTimestamps.trialEnd,
          dbTimestamps.cancelAtPeriodEnd,
          userData.UID
        ]
      );
      
      console.log(`[ActiveSubscriptionHandler] ✅ Successfully updated active subscription for user ${userData.UID}. Rows affected: ${result.rowCount}`);
    } catch (dbError: unknown) {
      console.error(`[ActiveSubscriptionHandler] ❌ Database update failed for user ${userData.UID}:`, dbError);
      throw dbError;
    } finally {
      client.release();
    }
  }
}

/**
 * Handler for trialing subscriptions
 */
export class TrialingSubscriptionHandler extends BaseSubscriptionHandler {
  async handle(subscription: Stripe.Subscription, userData: UserData): Promise<void> {
    const subscriptionId = subscription.id;
    const status = subscription.status;
    
    console.log(`[TrialingSubscriptionHandler] Processing trialing subscription ${subscriptionId} for user ${userData.UID}`);
    
    this.validateSubscriptionData(subscription);
    const plan = this.getPriceFromSubscription(subscription);
    
    // Get product information
    let productName = 'Unknown Plan';
    if (typeof plan.product === 'string') {
      console.log(`[TrialingSubscriptionHandler] 🔄 Fetching product details for ${plan.product}`);
      productName = await this.getProductName(plan.product);
    } else if (plan.product && 'name' in plan.product) {
      productName = plan.product.name || 'Unknown Plan';
    }
    
    // Extract and validate timestamps
    const timestamps = extractSubscriptionTimestamps(subscription);
    const validation = validateTimestamps(timestamps, status);
    
    if (validation.warnings.length > 0) {
      console.warn(`[TrialingSubscriptionHandler] Timestamp warnings for ${subscriptionId}:`, validation.warnings);
    }
    
    if (!validation.isValid) {
      console.error(`[TrialingSubscriptionHandler] ❌ Invalid timestamps for subscription ${subscriptionId}:`, validation.errors);
      throw new Error(`Invalid subscription timestamps: ${validation.errors.join(', ')}`);
    }
    
    console.log(`[TrialingSubscriptionHandler] Processed timestamps:`, {
      status,
      currentPeriodStart: timestamps.currentPeriodStart?.toISOString() ?? 'null',
      currentPeriodEnd: timestamps.currentPeriodEnd?.toISOString() ?? 'null',
      trialStart: timestamps.trialStart?.toISOString() ?? 'null',
      trialEnd: timestamps.trialEnd?.toISOString() ?? 'null',
      cancelAtPeriodEnd: timestamps.cancelAtPeriodEnd
    });
    
    // Update database
    await this.updateUserSubscription(userData, subscriptionId, productName, status, plan.id, timestamps);
  }

  private async updateUserSubscription(
    userData: UserData,
    subscriptionId: string,
    productName: string,
    status: string,
    priceId: string,
    timestamps: SubscriptionTimestamps
  ): Promise<void> {
    const client = await internalDb.connect();
    try {
      const dbTimestamps = formatTimestampsForDatabase(timestamps);
      
      console.log(`[TrialingSubscriptionHandler] Database params:`, {
        subscriptionId,
        productName,
        status,
        priceId,
        currentPeriodStart: dbTimestamps.currentPeriodStart,
        currentPeriodEnd: dbTimestamps.currentPeriodEnd,
        trialEnd: dbTimestamps.trialEnd,
        cancelAtPeriodEnd: dbTimestamps.cancelAtPeriodEnd,
        userId: userData.UID
      });
      
      const result = await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" 
         SET "stripeSubscriptionId" = $1, 
             "planName" = $2,
             "subscriptionStatus" = $3,
             "priceId" = $4,
             "currentPeriodStart" = $5,
             "currentPeriodEnd" = $6,
             "trialEnd" = $7,
             "cancelAtPeriodEnd" = $8,
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "UID" = $9`,
        [
          subscriptionId, 
          productName, 
          status, 
          priceId,
          dbTimestamps.currentPeriodStart,
          dbTimestamps.currentPeriodEnd,
          dbTimestamps.trialEnd,
          dbTimestamps.cancelAtPeriodEnd,
          userData.UID
        ]
      );
      
      console.log(`[TrialingSubscriptionHandler] ✅ Successfully updated trialing subscription for user ${userData.UID}. Rows affected: ${result.rowCount}`);
    } catch (dbError: unknown) {
      console.error(`[TrialingSubscriptionHandler] ❌ Database update failed for user ${userData.UID}:`, dbError);
      throw dbError;
    } finally {
      client.release();
    }
  }
}

/**
 * Handler for canceled and unpaid subscriptions
 */
export class CanceledSubscriptionHandler extends BaseSubscriptionHandler {
  async handle(subscription: Stripe.Subscription, userData: UserData): Promise<void> {
    const subscriptionId = subscription.id;
    const status = subscription.status;
    
    console.log(`[CanceledSubscriptionHandler] Processing ${status} subscription ${subscriptionId} for user ${userData.UID}`);
    
    await this.clearUserSubscription(userData, status);
  }

  private async clearUserSubscription(userData: UserData, status: string): Promise<void> {
    const client = await internalDb.connect();
    try {
      console.log(`[CanceledSubscriptionHandler] Clearing subscription data for user ${userData.UID}, status: ${status}`);
      
      await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" 
         SET "stripeSubscriptionId" = NULL, 
             "planName" = NULL,
             "subscriptionStatus" = $1,
             "priceId" = NULL,
             "currentPeriodStart" = NULL,
             "currentPeriodEnd" = NULL,
             "trialEnd" = NULL,
             "cancelAtPeriodEnd" = FALSE,
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "UID" = $2`,
        [status, userData.UID]
      );
      
      console.log(`[CanceledSubscriptionHandler] ✅ Successfully cleared subscription for user ${userData.UID}`);
    } catch (dbError: unknown) {
      console.error(`[CanceledSubscriptionHandler] ❌ Database update failed for user ${userData.UID}:`, dbError);
      throw dbError;
    } finally {
      client.release();
    }
  }
}

/**
 * Dispatcher that routes subscription events to the appropriate handler
 */
export class SubscriptionEventDispatcher {
  private activeHandler = new ActiveSubscriptionHandler();
  private trialingHandler = new TrialingSubscriptionHandler();
  private canceledHandler = new CanceledSubscriptionHandler();

  async dispatch(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const subscriptionId = subscription.id;
    const status = subscription.status;

    console.log(`[SubscriptionEventDispatcher] Processing subscription ${subscriptionId} for customer ${customerId}, status: ${status}`);

    // Get user data
    const userData = await this.getUserByCustomerId(customerId);
    if (!userData) {
      console.error(`[SubscriptionEventDispatcher] ❌ User not found for Stripe customer: ${customerId}`);
      await this.handleMissingUser(customerId, subscription);
      return;
    }

    console.log(`[SubscriptionEventDispatcher] Found user ${userData.UID} for customer ${customerId}`);

    // Route to appropriate handler
    const handler = this.getHandlerForStatus(status);
    await handler.handle(subscription, userData);
  }

  private getHandlerForStatus(status: string): BaseSubscriptionHandler {
    switch (status) {
      case 'active':
        return this.activeHandler;
      case 'trialing':
        return this.trialingHandler;
      case 'canceled':
      case 'unpaid':
        return this.canceledHandler;
      default:
        console.log(`[SubscriptionEventDispatcher] ⚠️ Unhandled subscription status: ${status}`);
        throw new Error(`Unhandled subscription status: ${status}`);
    }
  }

  private async getUserByCustomerId(customerId: string): Promise<UserData | null> {
    const client = await internalDb.connect();
    try {
      const result = await client.query(
        `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "stripeCustomerId" = $1`,
        [customerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as UserData;
    } finally {
      client.release();
    }
  }

  private async handleMissingUser(customerId: string, subscription: Stripe.Subscription): Promise<void> {
    console.error(`[SubscriptionEventDispatcher] This might indicate customer.created event was not processed or timing issue`);
    
    // For customer.subscription.created events, try to fetch customer from Stripe and create user record
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted && customer.metadata?.userId) {
        console.log(`[SubscriptionEventDispatcher] 🔄 Found customer in Stripe with userId: ${customer.metadata.userId}, creating user record`);
        await this.handleCustomerCreated(customer);
        
        // Retry dispatching
        const retryUserData = await this.getUserByCustomerId(customerId);
        if (retryUserData) {
          console.log(`[SubscriptionEventDispatcher] ✅ Successfully created and retrieved user ${retryUserData.UID}`);
          await this.dispatch(subscription);
          return;
        }
      }
    } catch (error) {
      console.error(`[SubscriptionEventDispatcher] ❌ Failed to create missing user record:`, error);
    }
    
    throw new Error(`Customer ${customerId} not found in database and could not be created`);
  }

  private async handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
    if (!customer.metadata?.userId) {
      console.error('[SubscriptionEventDispatcher] No userId in customer metadata');
      return;
    }

    const client = await internalDb.connect();
    try {
      await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" SET "stripeCustomerId" = $1 WHERE "UID" = $2`,
        [customer.id, customer.metadata.userId]
      );
      console.log(`[SubscriptionEventDispatcher] ✅ Updated user ${customer.metadata.userId} with Stripe customer ID: ${customer.id}`);
    } catch (error) {
      console.error('[SubscriptionEventDispatcher] ❌ Failed to update user with Stripe customer ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }
} 