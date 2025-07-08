import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { supabaseServer } from "~/util/supabase/server";
import { internalDb } from "~/server/internal-db";
import { env } from "~/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil'
});

// Type for user data from database
type UserData = {
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

export async function createCheckoutSession({
  priceId
}: {
  priceId: string;
}) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=pricing&priceId=${priceId}`);
  }

  // Get or create user data
  const client = await internalDb.connect();
  let userData: UserData;
  
  try {
    const result = await client.query(
      `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      // Create user data if it doesn't exist
      const createResult = await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID") VALUES ($1) RETURNING *`,
        [user.id]
      );
      userData = createResult.rows[0] as UserData;
    } else {
      userData = result.rows[0] as UserData;
    }
  } finally {
    client.release();
  }

  // Ensure we have a customer with proper metadata
  let customerId = userData.stripeCustomerId;
  
  if (!customerId) {
    // Create customer with metadata
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id
      }
    });
    customerId = customer.id;
    
    // Update our database with the customer ID
    const updateClient = await internalDb.connect();
    try {
      await updateClient.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" SET "stripeCustomerId" = $1 WHERE "UID" = $2`,
        [customerId, user.id]
      );
      console.log(`[createCheckoutSession] Created and saved Stripe customer ${customerId} for user ${user.id}`);
    } finally {
      updateClient.release();
    }
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.BASE_URL}/pricing`,
    customer: customerId,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14
    }
  });

  return session.url!;
}

export async function createCustomerPortalSession(userId: string) {
  const client = await internalDb.connect();
  let userData: UserData;
  
  try {
    const result = await client.query(
      `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      redirect('/pricing');
    }

    userData = result.rows[0] as UserData;
  } finally {
    client.release();
  }

  if (!userData.stripeCustomerId) {
    redirect('/pricing');
  }

  return stripe.billingPortal.sessions.create({
    customer: userData.stripeCustomerId,
    return_url: `${env.BASE_URL}/dashboard`,
  });
}

export async function getUserByStripeCustomerId(customerId: string): Promise<UserData | null> {
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

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  console.log(`[handleSubscriptionChange] Processing subscription ${subscriptionId} for customer ${customerId}, status: ${status}`);

  // Add validation for required data
  if (!customerId || !subscriptionId) {
    console.error(`[handleSubscriptionChange] ❌ Missing required data: customerId=${customerId}, subscriptionId=${subscriptionId}`);
    throw new Error('Missing required subscription data');
  }

  const userData = await getUserByStripeCustomerId(customerId);

  if (!userData) {
    console.error(`[handleSubscriptionChange] ❌ User not found for Stripe customer: ${customerId}`);
    console.error(`[handleSubscriptionChange] This might indicate customer.created event was not processed or timing issue`);
    
    // For customer.subscription.created events, try to fetch customer from Stripe and create user record
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted && customer.metadata?.userId) {
        console.log(`[handleSubscriptionChange] 🔄 Found customer in Stripe with userId: ${customer.metadata.userId}, creating user record`);
        await handleCustomerCreated(customer);
        
        // Retry getting user data
        const retryUserData = await getUserByStripeCustomerId(customerId);
        if (retryUserData) {
          console.log(`[handleSubscriptionChange] ✅ Successfully created and retrieved user ${retryUserData.UID}`);
          // Continue processing with the newly created user data
          return handleSubscriptionChange(subscription);
        }
      }
    } catch (error) {
      console.error(`[handleSubscriptionChange] ❌ Failed to create missing user record:`, error);
    }
    
    throw new Error(`Customer ${customerId} not found in database and could not be created`);
  }

  console.log(`[handleSubscriptionChange] Found user ${userData.UID} for customer ${customerId}`);

  const client = await internalDb.connect();
  try {
    if (status === 'active' || status === 'trialing') {
      // Validate subscription items exist
      if (!subscription.items?.data || subscription.items.data.length === 0) {
        console.error(`[handleSubscriptionChange] ❌ No subscription items found for subscription ${subscriptionId}`);
        throw new Error('Subscription has no items');
      }

      const plan = subscription.items.data[0]?.price;
      if (!plan) {
        console.error(`[handleSubscriptionChange] ❌ No price found in subscription items for ${subscriptionId}`);
        throw new Error('Subscription item has no price');
      }

      // Get product information from subscription items (already available in webhook)
      let productName = 'Unknown Plan';
      if (typeof plan.product === 'string') {
        console.log(`[handleSubscriptionChange] 🔄 Fetching product details for ${plan.product}`);
        try {
          const product = await stripe.products.retrieve(plan.product);
          productName = product.name || 'Unknown Plan';
        } catch (error) {
          console.error(`[handleSubscriptionChange] ⚠️ Failed to fetch product ${plan.product}:`, error);
          productName = 'Unknown Plan';
        }
      } else if (plan.product && 'name' in plan.product) {
        productName = plan.product.name || 'Unknown Plan';
      }
      
      // Access timestamps directly from subscription object using type assertion
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const currentPeriodStartTs = (subscription as any).current_period_start;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const currentPeriodEndTs = (subscription as any).current_period_end;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const trialEndTs = (subscription as any).trial_end;
      
      console.log(`[handleSubscriptionChange] Raw timestamps - start: ${currentPeriodStartTs}, end: ${currentPeriodEndTs}, trial: ${trialEndTs}`);
      
      // Validate and convert timestamps safely
      const currentPeriodStart = (currentPeriodStartTs && typeof currentPeriodStartTs === 'number' && !isNaN(currentPeriodStartTs)) 
        ? new Date(currentPeriodStartTs * 1000) : null;
      const currentPeriodEnd = (currentPeriodEndTs && typeof currentPeriodEndTs === 'number' && !isNaN(currentPeriodEndTs)) 
        ? new Date(currentPeriodEndTs * 1000) : null;
      const trialEnd = (trialEndTs && typeof trialEndTs === 'number' && !isNaN(trialEndTs)) 
        ? new Date(trialEndTs * 1000) : null;

      // For trialing subscriptions, use different validation logic
      if (status === 'trialing') {
        console.log(`[handleSubscriptionChange] Handling trialing subscription - using trial period`);
        
        // For trialing subscriptions, we might not have current_period_start/end yet
        // Use trial_start if available, otherwise set to null
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const trialStartTs = (subscription as any).trial_start;
        const trialStart = (trialStartTs && typeof trialStartTs === 'number' && !isNaN(trialStartTs)) 
          ? new Date(trialStartTs * 1000) : null;
        
        // For trialing, we'll use trial_start as period start and trial_end as period end if no current period is set
        const effectivePeriodStart = currentPeriodStart ?? trialStart;
        const effectivePeriodEnd = currentPeriodEnd ?? trialEnd;
        
        console.log(`[handleSubscriptionChange] Trial subscription - effective period: ${effectivePeriodStart?.toISOString() ?? 'null'} to ${effectivePeriodEnd?.toISOString() ?? 'null'}`);
        
        // Validate trial end date if it exists
        if (trialEnd && isNaN(trialEnd.getTime())) {
          console.error(`[handleSubscriptionChange] ❌ Invalid trial end timestamp for subscription ${subscriptionId}`);
          console.error(`[handleSubscriptionChange] Raw trial end: ${trialEndTs}`);
          console.error(`[handleSubscriptionChange] Converted trial end: ${trialEnd?.toString() ?? 'null'}`);
          throw new Error('Invalid trial end timestamp');
        }
        
        // Update the variables to use effective values
        // Note: We'll use null for period start/end for trialing if not available
        console.log(`[handleSubscriptionChange] Trialing subscription will store: start=${effectivePeriodStart?.toISOString() ?? 'null'}, end=${effectivePeriodEnd?.toISOString() ?? 'null'}, trial=${trialEnd?.toISOString() ?? 'null'}`);
        
      } else {
        // For non-trialing subscriptions, validate that we have valid period timestamps
        if (!currentPeriodStart || !currentPeriodEnd || isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
          console.error(`[handleSubscriptionChange] ❌ Invalid period timestamps for subscription ${subscriptionId}`);
          console.error(`[handleSubscriptionChange] Raw values: start=${currentPeriodStartTs}, end=${currentPeriodEndTs}`);
          console.error(`[handleSubscriptionChange] Converted values: start=${currentPeriodStart?.toString() ?? 'null'}, end=${currentPeriodEnd?.toString() ?? 'null'}`);
          throw new Error('Invalid subscription period timestamps');
        }
      }
      
      // Validate trial end date if it exists
      if (trialEnd && isNaN(trialEnd.getTime())) {
        console.error(`[handleSubscriptionChange] ❌ Invalid trial end timestamp for subscription ${subscriptionId}`);
        console.error(`[handleSubscriptionChange] Raw trial end: ${trialEndTs}`);
        console.error(`[handleSubscriptionChange] Converted trial end: ${trialEnd?.toString() ?? 'null'}`);
        throw new Error('Invalid trial end timestamp');
      }
      
      console.log(`[handleSubscriptionChange] Converted timestamps - start: ${currentPeriodStart?.toISOString() ?? 'null'}, end: ${currentPeriodEnd?.toISOString() ?? 'null'}, trial: ${trialEnd?.toISOString() ?? 'null'}`);
      console.log(`[handleSubscriptionChange] Updating user ${userData.UID} with active subscription: ${productName} (${plan.id})`);
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const cancelAtPeriodEnd = (subscription as any).cancel_at_period_end ?? false;
      console.log(`[handleSubscriptionChange] Database params:`, {
        subscriptionId,
        productName,
        status,
        priceId: plan.id,
        currentPeriodStart: currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
        trialEnd: trialEnd?.toISOString() ?? null,
        cancelAtPeriodEnd,
        userId: userData.UID
      });
      
      try {
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
            plan.id,
            currentPeriodStart,
            currentPeriodEnd,
            trialEnd,
            cancelAtPeriodEnd,
            userData.UID
          ]
        );
        
        console.log(`[handleSubscriptionChange] ✅ Successfully updated active subscription for user ${userData.UID}. Rows affected: ${result.rowCount}`);
      } catch (dbError: unknown) {
        console.error(`[handleSubscriptionChange] ❌ Database update failed for user ${userData.UID}:`, dbError);
        console.error(`[handleSubscriptionChange] Query params:`, {
          subscriptionId,
          productName,
          status,
          priceId: plan.id,
          currentPeriodStart,
          currentPeriodEnd,
          trialEnd,
          cancelAtPeriodEnd,
          userId: userData.UID
        });
        throw dbError;
      }
    } else if (status === 'canceled' || status === 'unpaid') {
      console.log(`[handleSubscriptionChange] Clearing subscription data for user ${userData.UID}, status: ${status}`);
      
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
      
      console.log(`[handleSubscriptionChange] ✅ Successfully cleared subscription for user ${userData.UID}`);
    } else {
      console.log(`[handleSubscriptionChange] ⚠️ Unhandled subscription status: ${status} for user ${userData.UID}`);
    }
  } catch (error: unknown) {
    console.error(`[handleSubscriptionChange] ❌ Database update failed for user ${userData.UID}:`, error);
    throw error;
  } finally {
    client.release();
  }
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment */

export async function handleCustomerCreated(customer: Stripe.Customer) {
  if (!customer.metadata?.userId) {
    console.error('No userId in customer metadata');
    return;
  }

  const client = await internalDb.connect();
  try {
    await client.query(
      `UPDATE "${env.NC_SCHEMA}"."userData" 
       SET "stripeCustomerId" = $1, 
           "updated_at" = CURRENT_TIMESTAMP
       WHERE "UID" = $2`,
      [customer.id, customer.metadata.userId]
    );
  } finally {
    client.release();
  }
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring'
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    productName:
      typeof price.product === 'string' ? '' : 
      ('name' in price.product ? price.product.name : ''),
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export type StripePrice = {
  id: string;
  productId: string;
  productName: string;
  unitAmount: number | null;
  currency: string;
  interval: string | undefined;
  trialPeriodDays: number | null | undefined;
};

export type OrganizedPrices = Record<string, {
  productName: string;
  monthly?: StripePrice;
  yearly?: StripePrice;
  savings?: number; // Percentage savings when choosing yearly
}>;

export async function getOrganizedStripePrices(): Promise<OrganizedPrices> {
  const prices = await getStripePrices();
  const organized: OrganizedPrices = {};

  // Group prices by product
  prices.forEach((price) => {
    if (!organized[price.productId]) {
      organized[price.productId] = {
        productName: price.productName,
      };
    }

    if (price.interval === 'month') {
      organized[price.productId]!.monthly = price;
    } else if (price.interval === 'year') {
      organized[price.productId]!.yearly = price;
    }
  });

  // Calculate savings for each product
  Object.keys(organized).forEach((productId) => {
    const product = organized[productId];
    if (product?.monthly && product?.yearly) {
      product.savings = calculateSavings(product.monthly, product.yearly);
    }
  });

  return organized;
}

export function calculateSavings(monthlyPrice: StripePrice, yearlyPrice: StripePrice): number {
  if (!monthlyPrice.unitAmount || !yearlyPrice.unitAmount) return 0;
  
  const monthlyTotal = monthlyPrice.unitAmount * 12;
  const savings = ((monthlyTotal - yearlyPrice.unitAmount) / monthlyTotal) * 100;
  
  return Math.round(Math.max(0, savings)); // Ensure non-negative savings
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price']
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}

// Enhanced subscription management functions

export async function getCurrentSubscription(userId: string) {
  const client = await internalDb.connect();
  try {
    const result = await client.query(
      `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const userData = result.rows[0] as UserData;
    
    // If user has no active subscription, return null
    if (!userData.stripeSubscriptionId) {
      return null;
    }

    // Fetch fresh subscription data from Stripe
    const subscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId, {
      expand: ['items.data.price.product']
    });

    return {
      ...userData,
      subscription,
      currentPrice: subscription.items.data[0]?.price,
      currentProduct: subscription.items.data[0]?.price.product
    };
  } finally {
    client.release();
  }
}

export async function compareSubscriptionPrices(userId: string, targetPriceId: string) {
  const currentSub = await getCurrentSubscription(userId);
  
  if (!currentSub?.subscription) {
    return {
      isUpgrade: false,
      isDowngrade: false,
      isSamePlan: false,
      isSameBillingCycle: false,
      priceDifference: 0,
      currentPrice: null,
      targetPrice: null
    };
  }

  const targetPrice = await stripe.prices.retrieve(targetPriceId, {
    expand: ['product']
  });

  const currentPrice = currentSub.currentPrice;
  
  if (!currentPrice) {
    return {
      isUpgrade: false,
      isDowngrade: false,
      isSamePlan: false,
      isSameBillingCycle: false,
      priceDifference: 0,
      currentPrice: null,
      targetPrice
    };
  }

  const isSamePlan = currentPrice.id === targetPrice.id;
  const isSameProduct = currentPrice.product === targetPrice.product || 
    (typeof currentPrice.product === 'object' && currentPrice.product?.id === targetPrice.product) ||
    (typeof targetPrice.product === 'object' && currentPrice.product === targetPrice.product.id);
  
  const isSameBillingCycle = currentPrice.recurring?.interval === targetPrice.recurring?.interval;

  // Calculate price difference (monthly normalized)
  const currentMonthlyAmount = currentPrice.recurring?.interval === 'year' 
    ? (currentPrice.unit_amount ?? 0) / 12 
    : (currentPrice.unit_amount ?? 0);
  
  const targetMonthlyAmount = targetPrice.recurring?.interval === 'year'
    ? (targetPrice.unit_amount ?? 0) / 12
    : (targetPrice.unit_amount ?? 0);

  const priceDifference = targetMonthlyAmount - currentMonthlyAmount;

  return {
    isUpgrade: !isSamePlan && priceDifference > 0,
    isDowngrade: !isSamePlan && priceDifference < 0,
    isSamePlan,
    isSameBillingCycle,
    isSameProduct,
    priceDifference: Math.round(priceDifference / 100), // Convert to dollars
    currentPrice,
    targetPrice
  };
}

export async function upgradeSubscription(userId: string, newPriceId: string, prorationBehavior: 'create_prorations' | 'none' = 'create_prorations') {
  const currentSub = await getCurrentSubscription(userId);
  
  if (!currentSub?.subscription) {
    throw new Error('No active subscription found');
  }

  const subscription = await stripe.subscriptions.update(currentSub.subscription.id, {
    items: [{
      id: currentSub.subscription.items.data[0]?.id,
      price: newPriceId,
    }],
    proration_behavior: prorationBehavior,
  });

  return subscription;
}

export async function scheduleSubscriptionChange(userId: string, newPriceId: string) {
  const currentSub = await getCurrentSubscription(userId);
  
  if (!currentSub?.subscription) {
    throw new Error('No active subscription found');
  }

  const subscription = await stripe.subscriptions.update(currentSub.subscription.id, {
    items: [{
      id: currentSub.subscription.items.data[0]?.id,
      price: newPriceId,
    }],
    proration_behavior: 'none',
    billing_cycle_anchor: 'unchanged',
  });

  return subscription;
}

export async function previewSubscriptionChange(userId: string, newPriceId: string) {
  const currentSub = await getCurrentSubscription(userId);
  
  if (!currentSub?.subscription) {
    throw new Error('No active subscription found');
  }

  // For now, return a simple preview without calling the Stripe API
  // This can be enhanced later with the correct Stripe API method
  const comparison = await compareSubscriptionPrices(userId, newPriceId);
  
  return {
    immediateCharge: comparison.priceDifference > 0 ? comparison.priceDifference * 100 : 0,
    nextInvoiceAmount: comparison.priceDifference > 0 ? comparison.priceDifference * 100 : 0,
    prorationAmount: comparison.priceDifference * 100,
    creditAmount: comparison.priceDifference < 0 ? Math.abs(comparison.priceDifference) * 100 : 0,
  };
} 