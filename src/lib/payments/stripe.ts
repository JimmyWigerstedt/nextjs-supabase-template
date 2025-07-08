import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { supabaseServer } from "~/util/supabase/server";
import { internalDb } from "~/server/internal-db";
import { env } from "~/env";
import { SubscriptionEventDispatcher } from './subscription-handlers';

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

/**
 * Handles subscription changes by dispatching to appropriate handlers
 * @param subscription - The Stripe subscription object
 */
export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const dispatcher = new SubscriptionEventDispatcher();
  await dispatcher.dispatch(subscription);
}

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
  
  // Get product IDs for comparison
  const currentProductId = typeof currentPrice.product === 'string' 
    ? currentPrice.product 
    : currentPrice.product?.id;
  const targetProductId = typeof targetPrice.product === 'string' 
    ? targetPrice.product 
    : targetPrice.product?.id;
  
  const isSameProduct = currentProductId === targetProductId;
  const isSameBillingCycle = currentPrice.recurring?.interval === targetPrice.recurring?.interval;
  
  console.log(`[compareSubscriptionPrices] Product comparison: current=${currentProductId}, target=${targetProductId}, same=${isSameProduct}`);
  console.log(`[compareSubscriptionPrices] Billing cycle comparison: current=${currentPrice.recurring?.interval}, target=${targetPrice.recurring?.interval}, same=${isSameBillingCycle}`);

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

  // Get the target price to check if it's an interval change
  const targetPrice = await stripe.prices.retrieve(newPriceId);
  const currentPrice = currentSub.currentPrice;
  
  // Check if this is a billing interval change (monthly ↔ yearly)
  const isIntervalChange = currentPrice?.recurring?.interval !== targetPrice.recurring?.interval;
  
  if (isIntervalChange) {
    // For interval changes, we need to do an immediate upgrade since billing_cycle_anchor: 'unchanged' is not supported
    console.log(`[scheduleSubscriptionChange] Interval change detected (${currentPrice?.recurring?.interval} → ${targetPrice.recurring?.interval}), performing immediate upgrade`);
    
    const subscription = await stripe.subscriptions.update(currentSub.subscription.id, {
      items: [{
        id: currentSub.subscription.items.data[0]?.id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
    });

    return subscription;
  } else {
    // For same-interval changes, schedule for end of period
    console.log(`[scheduleSubscriptionChange] Same interval change, scheduling for end of period`);
    
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