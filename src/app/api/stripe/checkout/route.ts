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
    return NextResponse.redirect(new URL('/pricing', request.url));
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

    // Update userData table with subscription information
    const client = await internalDb.connect();
    try {
      await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" 
         ("UID", "stripeCustomerId", "stripeSubscriptionId", "planName", "subscriptionStatus", "updated_at") 
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT ("UID") 
         DO UPDATE SET 
           "stripeCustomerId" = EXCLUDED."stripeCustomerId",
           "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId",
           "planName" = EXCLUDED."planName",
           "subscriptionStatus" = EXCLUDED."subscriptionStatus",
           "updated_at" = CURRENT_TIMESTAMP`,
        [userId, customerId, subscriptionId, product.name, subscription.status]
      );
    } finally {
      client.release();
    }

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
