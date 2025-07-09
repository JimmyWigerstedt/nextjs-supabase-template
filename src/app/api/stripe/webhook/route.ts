import type Stripe from 'stripe';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { stripe } from '~/lib/payments/stripe';
import { subscriptionService } from '~/lib/subscription-service';
import { env } from "~/env";

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  console.log(`[webhook] Processing Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        console.log(`[webhook] Syncing subscription: ${subscription.id}`);
        
        // Simple sync - just update minimal local data
        await subscriptionService.syncSubscriptionFromWebhook(subscription);
        break;
      
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`[webhook] Checkout completed: ${session.id}`);
        
        // For subscription checkouts, sync the subscription
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await subscriptionService.syncSubscriptionFromWebhook(subscription);
        }
        break;
      
      default:
        console.log(`[webhook] Ignoring event type: ${event.type}`);
        break;
    }

    console.log(`[webhook] ✅ Successfully processed ${event.type}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook] ❌ Error processing ${event.type}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
