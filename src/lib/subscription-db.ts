import { internalDb } from "~/server/internal-db";
import { env } from "~/env";
import Stripe from "stripe";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
});

export interface MinimalSubscriptionData {
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_plan?: string;
  subscription_status?: string;
}

export interface StripeSubscriptionData {
  id: string;
  customer: string;
  status: Stripe.Subscription.Status;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  items: {
    price_id: string;
    product_id: string;
  }[];
}

/**
 * Get plan name from StripeSubscriptionData
 */
export async function getPlanNameFromSubscriptionData(subscription: StripeSubscriptionData): Promise<string> {
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
 * Update minimal subscription data for a user
 */
export async function updateMinimalSubscriptionData(
  userId: string,
  data: MinimalSubscriptionData
): Promise<void> {
  const client = await internalDb.connect();
  
  try {
    // First, check if user record exists
    const existingUser = await client.query(
      `SELECT "UID" FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
      [userId]
    );

    if (existingUser.rows.length === 0) {
      // Create new user record with minimal data
      const fields = ['UID'];
      const values = [userId];
      const placeholders = ['$1'];
      
      Object.entries(data).forEach(([key, value], index) => {
        if (value !== undefined) {
          fields.push(`"${key}"`);
          values.push(value as string);
          placeholders.push(`$${index + 2}`);
        }
      });

      await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      );
    } else {
      // Update existing user record
      const updates: string[] = [];
      const values: (string | undefined)[] = [];
      let paramIndex = 1;

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`"${key}" = $${paramIndex}`);
          values.push(value as string);
          paramIndex++;
        }
      });

      if (updates.length > 0) {
        values.push(userId); // Add userId as the last parameter
        await client.query(
          `UPDATE "${env.NC_SCHEMA}"."userData" SET ${updates.join(', ')} WHERE "UID" = $${paramIndex}`,
          values
        );
      }
    }
  } catch (error) {
    console.error('Failed to update minimal subscription data:', error);
    throw new Error('Failed to update subscription data');
  } finally {
    client.release();
  }
}

/**
 * Get minimal subscription data for a user
 */
export async function getMinimalSubscriptionData(userId: string): Promise<MinimalSubscriptionData> {
  const client = await internalDb.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        "stripe_customer_id",
        "stripe_subscription_id", 
        "subscription_plan",
        "subscription_status"
      FROM "${env.NC_SCHEMA}"."userData" 
      WHERE "UID" = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const row = result.rows[0] as Record<string, string | null>;
    
    return {
      stripe_customer_id: row.stripe_customer_id ?? undefined,
      stripe_subscription_id: row.stripe_subscription_id ?? undefined,
      subscription_plan: row.subscription_plan ?? undefined,
      subscription_status: row.subscription_status ?? undefined,
    };
  } catch (error) {
    console.error('Failed to get minimal subscription data:', error);
    throw new Error('Failed to retrieve subscription data');
  } finally {
    client.release();
  }
}

/**
 * Clear all subscription data for a user (useful for cleanup)
 */
export async function clearSubscriptionData(userId: string): Promise<void> {
  const client = await internalDb.connect();
  
  try {
    await client.query(
      `UPDATE "${env.NC_SCHEMA}"."userData" 
       SET "stripe_customer_id" = NULL,
           "stripe_subscription_id" = NULL,
           "subscription_plan" = NULL,
           "subscription_status" = NULL
       WHERE "UID" = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Failed to clear subscription data:', error);
    throw new Error('Failed to clear subscription data');
  } finally {
    client.release();
  }
}

/**
 * Get all users with active subscriptions (useful for batch operations)
 */
export async function getUsersWithActiveSubscriptions(): Promise<Array<{ userId: string; data: MinimalSubscriptionData }>> {
  const client = await internalDb.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        "UID",
        "stripe_customer_id",
        "stripe_subscription_id",
        "subscription_plan", 
        "subscription_status"
      FROM "${env.NC_SCHEMA}"."userData" 
      WHERE "subscription_status" = 'active'
      AND "stripe_customer_id" IS NOT NULL`
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return result.rows.map((row: Record<string, string | null>) => ({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      userId: (row as any).UID as string,
      data: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        stripe_customer_id: (row as any).stripe_customer_id ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        stripe_subscription_id: (row as any).stripe_subscription_id ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        subscription_plan: (row as any).subscription_plan ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        subscription_status: (row as any).subscription_status ?? undefined,
      },
    }));
  } catch (error) {
    console.error('Failed to get users with active subscriptions:', error);
    throw new Error('Failed to retrieve users with active subscriptions');
  } finally {
    client.release();
  }
}

/**
 * Check if minimal subscription fields exist in the database
 */
export async function checkSubscriptionFieldsExist(): Promise<{
  stripe_customer_id: boolean;
  stripe_subscription_id: boolean;
  subscription_plan: boolean;
  subscription_status: boolean;
}> {
  const client = await internalDb.connect();
  
  try {
    const result = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = $1 
       AND table_name = 'userData' 
       AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'subscription_plan', 'subscription_status')`,
      [env.NC_SCHEMA]
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const existingFields = result.rows.map((row: Record<string, string>) => 
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      (row as any).column_name as string
    );
    
    return {
      stripe_customer_id: existingFields.includes('stripe_customer_id'),
      stripe_subscription_id: existingFields.includes('stripe_subscription_id'),
      subscription_plan: existingFields.includes('subscription_plan'),
      subscription_status: existingFields.includes('subscription_status'),
    };
  } catch (error) {
    console.error('Failed to check subscription fields:', error);
    throw new Error('Failed to check subscription fields');
  } finally {
    client.release();
  }
} 