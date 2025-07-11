import { internalDb } from "~/server/internal-db";
import { env } from "~/env";
import type Stripe from "stripe";

/**
 * Local subscription metadata stored for cache-first operations
 * 
 * Architecture notes: Despite the name "Minimal", this stores comprehensive subscription
 * metadata required for performance optimization and offline operation capability.
 * All fields are optional to handle partial sync states during webhook processing.
 */
export interface MinimalSubscriptionData {
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_plan?: string;
  subscription_status?: string;
  usage_credits?: number;
}

/**
 * Standardized subscription data format for internal operations
 * 
 * Architecture notes: Normalized representation of Stripe subscription data
 * with resolved product information for feature access control.
 */
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
 * Upsert subscription metadata in local database with comprehensive field handling
 * 
 * Implementation notes: Handles both user creation and updates, with dynamic SQL
 * generation for partial updates. Stores all subscription-related metadata for
 * performance optimization of feature access checks.
 * Used by: Webhook sync, subscription service cache updates
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
 * Retrieve cached subscription metadata from local database
 * 
 * Implementation notes: Database query to userData table for comprehensive subscription
 * metadata including customer IDs, subscription IDs, plan names, and status.
 * Used by: All subscription operations as first step in cache-first strategy
 */
export async function getMinimalSubscriptionData(userId: string): Promise<MinimalSubscriptionData> {
  const client = await internalDb.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        "stripe_customer_id",
        "stripe_subscription_id", 
        "subscription_plan",
        "subscription_status",
        "usage_credits"
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
      usage_credits: row.usage_credits ? (() => {
        const credits = parseInt(row.usage_credits, 10);
        return isNaN(credits) ? undefined : credits;
      })() : undefined,
    };
  } catch (error) {
    console.error('Failed to get minimal subscription data:', error);
    throw new Error('Failed to retrieve subscription data');
  } finally {
    client.release();
  }
}

/**
 * Remove all subscription metadata for user cleanup operations
 * 
 * Implementation notes: Sets all subscription fields to NULL rather than deleting
 * the user record to preserve other user data.
 * Used by: Account cleanup, subscription cancellation processing
 */
export async function clearSubscriptionData(userId: string): Promise<void> {
  const client = await internalDb.connect();
  
  try {
    await client.query(
      `UPDATE "${env.NC_SCHEMA}"."userData" 
       SET "stripe_customer_id" = NULL,
           "stripe_subscription_id" = NULL,
           "subscription_plan" = NULL,
           "subscription_status" = NULL,
           "usage_credits" = NULL
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
 * Query users with active subscriptions for batch operations
 * 
 * Implementation notes: Filters by subscription_status = 'active' and non-null
 * customer_id to find users with valid Stripe subscriptions.
 * Used by: Bulk operations, subscription analytics, cleanup jobs
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
 * Database schema validation for subscription metadata fields
 * 
 * Implementation notes: Checks information_schema for required columns to handle
 * database migration scenarios and schema evolution.
 * Used by: Application startup, database migration validation
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

/**
 * Set/replace user credits (for renewals and initial signups)
 * 
 * Implementation notes: Uses database transaction with FOR UPDATE locking
 * to prevent race conditions. Replaces existing credits with new value.
 * Used by: Invoice payment processing for subscription_cycle and subscription_create
 */
export async function setUserCredits(userId: string, credits: number): Promise<void> {
  const client = await internalDb.connect();
  
  try {
    await client.query('BEGIN');
    
    // First, check if user record exists with FOR UPDATE lock
    const existingUser = await client.query(
      `SELECT "UID", "usage_credits" FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1 FOR UPDATE`,
      [userId]
    );

    if (existingUser.rows.length === 0) {
      // Create new user record with credits
      await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID", "usage_credits") VALUES ($1, $2)`,
        [userId, credits]
      );
    } else {
      // Update existing user record with new credits
      await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" SET "usage_credits" = $1 WHERE "UID" = $2`,
        [credits, userId]
      );
    }
    
    await client.query('COMMIT');
    console.log(`[credits] Set user ${userId} credits to ${credits}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to set user credits:', error);
    throw new Error('Failed to set user credits');
  } finally {
    client.release();
  }
}

/**
 * Add credits to existing user balance (for upgrades and add-ons)
 * 
 * Implementation notes: Uses database transaction with FOR UPDATE locking
 * to prevent race conditions. Adds credits to existing balance.
 * Used by: Invoice payment processing for subscription_update and manual billing
 */
export async function addUserCredits(userId: string, credits: number): Promise<void> {
  const client = await internalDb.connect();
  
  try {
    await client.query('BEGIN');
    
    // First, check if user record exists with FOR UPDATE lock
    const existingUser = await client.query(
      `SELECT "UID", "usage_credits" FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1 FOR UPDATE`,
      [userId]
    );

    if (existingUser.rows.length === 0) {
      // Create new user record with credits
      await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID", "usage_credits") VALUES ($1, $2)`,
        [userId, credits]
      );
    } else {
      // Add credits to existing balance
      const currentCreditsValue = (existingUser.rows[0] as { usage_credits?: string | number })?.usage_credits;
      const currentCredits = typeof currentCreditsValue === 'string' ? parseInt(currentCreditsValue, 10) : (currentCreditsValue ?? 0);
      const safeCurrentCredits = isNaN(currentCredits) ? 0 : currentCredits;
      const newCredits = safeCurrentCredits + credits;
      
      await client.query(
        `UPDATE "${env.NC_SCHEMA}"."userData" SET "usage_credits" = $1 WHERE "UID" = $2`,
        [newCredits, userId]
      );
    }
    
    await client.query('COMMIT');
    console.log(`[credits] Added ${credits} credits to user ${userId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to add user credits:', error);
    throw new Error('Failed to add user credits');
  } finally {
    client.release();
  }
} 