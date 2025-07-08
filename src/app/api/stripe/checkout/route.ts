import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { stripe } from '~/lib/payments/stripe';
import { internalDb } from "~/server/internal-db";
import { env } from "~/env";
import type Stripe from 'stripe';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/pricing', env.BASE_URL));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    if (!session.customer || typeof session.customer === 'string') {
      throw new Error('Invalid customer data from Stripe.');
    }

    const customerId = session.customer.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      throw new Error('No subscription found for this session.');
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });

    const plan = subscription.items.data[0]?.price;

    if (!plan) {
      throw new Error('No plan found for this subscription.');
    }

    const product = plan.product as Stripe.Product;
    if (!product?.id) {
      throw new Error('No product ID found for this subscription.');
    }

    const userId = session.client_reference_id;
    if (!userId) {
      throw new Error("No user ID found in session's client_reference_id.");
    }

    // Ensure user exists in database
    const userCheckClient = await internalDb.connect();
    try {
      const userCheck = await userCheckClient.query(
        `SELECT "UID" FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        // Create user record if it doesn't exist
        console.log(`[checkout] Creating user record for UID: ${userId}`);
        await userCheckClient.query(
          `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID", "created_at", "updated_at") 
           VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT ("UID") DO NOTHING`,
          [userId]
        );
      }
    } finally {
      userCheckClient.release();
    }

    // Safely convert timestamps with validation - try subscription object first, then subscription items
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    let currentPeriodStartTs = (subscription as any).current_period_start;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    let currentPeriodEndTs = (subscription as any).current_period_end;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const trialEndTs = (subscription as any).trial_end;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const cancelAtPeriodEnd = (subscription as any).cancel_at_period_end ?? false;

    // If not found on subscription object, try subscription items (common for active subscriptions)
    if (!currentPeriodStartTs && subscription.items?.data?.[0]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      currentPeriodStartTs = (subscription.items.data[0] as any).current_period_start;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      currentPeriodEndTs = (subscription.items.data[0] as any).current_period_end;
      console.log(`[checkout] Using timestamps from subscription items`);
    }

    console.log(`[checkout] Raw timestamps - start: ${currentPeriodStartTs}, end: ${currentPeriodEndTs}, trial: ${trialEndTs}`);

    // Validate and convert timestamps safely
    const currentPeriodStart = (currentPeriodStartTs && typeof currentPeriodStartTs === 'number' && !isNaN(currentPeriodStartTs)) 
      ? new Date(currentPeriodStartTs * 1000) : null;
    const currentPeriodEnd = (currentPeriodEndTs && typeof currentPeriodEndTs === 'number' && !isNaN(currentPeriodEndTs)) 
      ? new Date(currentPeriodEndTs * 1000) : null;
    const trialEnd = (trialEndTs && typeof trialEndTs === 'number' && !isNaN(trialEndTs)) 
      ? new Date(trialEndTs * 1000) : null;

    // For trialing subscriptions, handle missing current period timestamps
    if (subscription.status === 'trialing') {
      console.log(`[checkout] Handling trialing subscription - period timestamps may be null`);
      
      // Validate trial end date if it exists
      if (trialEnd && isNaN(trialEnd.getTime())) {
        console.error(`[checkout] ❌ Invalid trial end timestamp for subscription ${subscriptionId}`);
        console.error(`[checkout] Raw trial end: ${trialEndTs}`);
        throw new Error('Invalid trial end timestamp');
      }
      
      console.log(`[checkout] Trialing subscription will store: start=${currentPeriodStart?.toISOString() ?? 'null'}, end=${currentPeriodEnd?.toISOString() ?? 'null'}, trial=${trialEnd?.toISOString() ?? 'null'}`);
      
    } else {
      // For non-trialing subscriptions, validate that we have valid period timestamps
      if (!currentPeriodStart || !currentPeriodEnd || isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
        console.error(`[checkout] ❌ Invalid period timestamps for subscription ${subscriptionId}`);
        console.error(`[checkout] Raw values: start=${currentPeriodStartTs}, end=${currentPeriodEndTs}`);
        throw new Error('Invalid subscription period timestamps');
      }
      
      // Validate trial end date if it exists
      if (trialEnd && isNaN(trialEnd.getTime())) {
        console.error(`[checkout] ❌ Invalid trial end timestamp for subscription ${subscriptionId}`);
        console.error(`[checkout] Raw trial end: ${trialEndTs}`);
        throw new Error('Invalid trial end timestamp');
      }
    }

    console.log(`[checkout] Converted timestamps - start: ${currentPeriodStart?.toISOString() ?? 'null'}, end: ${currentPeriodEnd?.toISOString() ?? 'null'}, trial: ${trialEnd?.toISOString() ?? 'null'}`);

    // Update userData table with subscription information
    const client = await internalDb.connect();
    try {
      await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" 
         ("UID", "stripeCustomerId", "stripeSubscriptionId", "planName", "subscriptionStatus", "priceId", "currentPeriodStart", "currentPeriodEnd", "trialEnd", "cancelAtPeriodEnd", "updated_at") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
         ON CONFLICT ("UID") 
         DO UPDATE SET 
           "stripeCustomerId" = EXCLUDED."stripeCustomerId",
           "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId",
           "planName" = EXCLUDED."planName",
           "subscriptionStatus" = EXCLUDED."subscriptionStatus",
           "priceId" = EXCLUDED."priceId",
           "currentPeriodStart" = EXCLUDED."currentPeriodStart",
           "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
           "trialEnd" = EXCLUDED."trialEnd",
           "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
           "updated_at" = CURRENT_TIMESTAMP`,
        [
          userId, 
          customerId, 
          subscriptionId, 
          product.name, 
          subscription.status,
          plan.id,
          currentPeriodStart,
          currentPeriodEnd,
          trialEnd,
          cancelAtPeriodEnd
        ]
      );
    } finally {
      client.release();
    }

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', env.BASE_URL));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/pricing?error=checkout-failed', env.BASE_URL));
  }
}
