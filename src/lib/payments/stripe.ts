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
    customer: userData.stripeCustomerId ?? undefined,
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

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const userData = await getUserByStripeCustomerId(customerId);

  if (!userData) {
    console.error('User not found for Stripe customer:', customerId);
    return;
  }

  const client = await internalDb.connect();
  try {
    if (status === 'active' || status === 'trialing') {
      const plan = subscription.items.data[0]?.price;
      const product = await stripe.products.retrieve(plan?.product as string);
      
      await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" 
         SET "stripeSubscriptionId" = $1, 
             "planName" = $2,
             "subscriptionStatus" = $3,
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "UID" = $4`,
        [subscriptionId, product.name, status, userData.UID]
      );
    } else if (status === 'canceled' || status === 'unpaid') {
      await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" 
         SET "stripeSubscriptionId" = NULL, 
             "planName" = NULL,
             "subscriptionStatus" = $1,
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "UID" = $2`,
        [status, userData.UID]
      );
    }
  } finally {
    client.release();
  }
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

export type OrganizedPrices = {
  [productId: string]: {
    productName: string;
    monthly?: StripePrice;
    yearly?: StripePrice;
    savings?: number; // Percentage savings when choosing yearly
  };
};

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
    if (product && product.monthly && product.yearly) {
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