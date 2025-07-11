import type Stripe from 'stripe';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { stripe } from '~/lib/payments/stripe';
import { subscriptionService } from '~/lib/subscription-service';
import { env } from "~/env";

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook handler for real-time subscription synchronization
 * 
 * Architecture notes: Processes Stripe events to maintain local cache consistency.
 * Handles subscription lifecycle events and checkout completion to ensure local
 * subscription metadata remains synchronized with Stripe's authoritative state.
 * 
 * Implementation notes: Webhook signature verification, event type routing, and
 * comprehensive error handling with detailed logging for sync debugging.
 * Used by: Stripe event delivery system for real-time subscription updates
 */
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
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        console.log(`[webhook] Invoice payment succeeded: ${invoice.id}`);
        
        /**
         * Payment-first credit allocation
         * 
         * Implementation notes: Processes invoice payment to allocate credits only when
         * money is actually collected. Uses billing_reason to determine ADD vs REPLACE
         * logic and includes proper idempotency protection.
         */
        
        // Validate invoice ID
        if (!invoice.id) {
          console.error('[webhook] Invoice has no ID');
          break;
        }
        
        // Extract user ID from invoice subscription metadata
        const userId = await subscriptionService.extractUserIdFromInvoice(invoice);
        if (!userId) {
          console.error('[webhook] No user_id found in invoice');
          break;
        }
        
        // Check idempotency to prevent duplicate processing
        if (await subscriptionService.isInvoiceProcessed(invoice.id)) {
          console.log(`[webhook] Invoice ${invoice.id} already processed, skipping`);
          break;
        }
        
        // Calculate credits from current subscription state
        const totalCredits = await subscriptionService.calculateCreditsFromInvoice(invoice);
        
        if (totalCredits > 0) {
          // Allocate credits based on billing reason
          const billingReason = invoice.billing_reason ?? 'manual';
          await subscriptionService.handleCreditAllocation(billingReason, userId, totalCredits);
          
          console.log(`[webhook] ✅ Allocated ${totalCredits} credits to user ${userId} for invoice ${invoice.id}`);
        } else {
          console.log(`[webhook] No credits found in invoice ${invoice.id} - processing without credit allocation`);
        }
        
        // Always mark invoice as processed for idempotency (even if no credits)
        await subscriptionService.markInvoiceProcessed(invoice.id);
        break;
      
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`[webhook] Checkout completed: ${session.id}`);
        
        /**
         * Post-checkout subscription sync
         * 
         * Implementation notes: For subscription checkouts, retrieves the created
         * subscription from Stripe and syncs to local cache. Ensures immediate
         * availability of subscription data after successful payment.
         */
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await subscriptionService.syncSubscriptionFromWebhook(subscription);
        }
        break;
      
      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object;
        console.log(`[webhook] Subscription updated: ${updatedSubscription.id}, status: ${updatedSubscription.status}`);
        
        /**
         * Subscription status and plan change sync
         * 
         * Implementation notes: Handles subscription status changes (active → canceled),
         * plan upgrades/downgrades, and other subscription modifications from Customer Portal.
         * Ensures local cache stays synchronized with Stripe's authoritative state.
         */
        await subscriptionService.syncSubscriptionFromWebhook(updatedSubscription);
        break;
      
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log(`[webhook] Subscription deleted: ${deletedSubscription.id}`);
        
        /**
         * Subscription deletion sync
         * 
         * Implementation notes: Handles complete subscription removal from Stripe.
         * Updates local cache to reflect the deleted subscription status.
         */
        await subscriptionService.syncSubscriptionFromWebhook(deletedSubscription);
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
