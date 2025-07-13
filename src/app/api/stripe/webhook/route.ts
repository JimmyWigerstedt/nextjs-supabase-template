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
         * SUBSCRIPTION PAYMENT PROCESSING
         * 
         * Implementation notes: Processes subscription invoice payments to allocate credits only when
         * money is actually collected. Uses billing_reason to determine ADD vs REPLACE logic.
         * 
         * NOTE: This handler is ONLY for subscription-related invoices. One-time payments
         * do NOT generate invoices and are handled in checkout.session.completed instead.
         */
        
        // Validate invoice ID
        if (!invoice.id) {
          console.error('[webhook] Invoice has no ID');
          break;
        }
        
        // Extract user ID from subscription invoice metadata
        const userId = await subscriptionService.extractUserIdFromInvoice(invoice);
        if (!userId) {
          console.error('[webhook] No user_id found in subscription invoice');
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
          // For subscriptions, use billing reason logic
          const billingReason = invoice.billing_reason ?? 'manual';
          await subscriptionService.handleCreditAllocation(billingReason, userId, totalCredits);
          console.log(`[webhook] ✅ Allocated ${totalCredits} credits to user ${userId} for subscription invoice ${invoice.id}`);
        } else {
          console.log(`[webhook] No credits found in subscription invoice ${invoice.id} - processing without credit allocation`);
        }
        
        // Always mark invoice as processed for idempotency (even if no credits)
        await subscriptionService.markInvoiceProcessed(invoice.id);
        break;
      
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`[webhook] Checkout completed: ${session.id}, mode: ${session.mode}, status: ${session.status}, payment_status: ${session.payment_status}`);
        
        /**
         * HYBRID CHECKOUT PROCESSING
         * 
         * This handler processes TWO types of checkout completions:
         * 1. SUBSCRIPTION CHECKOUTS: Sync subscription data to local cache
         * 2. ONE-TIME PAYMENT CHECKOUTS: Process credit allocation immediately
         * 
         * NOTE: One-time payments do NOT generate invoices, so we must handle
         * credit allocation here rather than waiting for invoice.payment_succeeded
         * which will never fire for one-time payments.
         */
        
        // Handle ONE-TIME PAYMENTS (Credit Bundles)
        if (session.mode === 'payment' && 
            session.payment_status === 'paid' && 
            session.status === 'complete') {
          
          console.log(`[webhook] Processing one-time payment: ${session.id}`);
          
          // Extract user ID and credits directly from session metadata
          const userId = session.metadata?.user_id;
          const creditsStr = session.metadata?.usage_credits;
          
          if (!userId) {
            console.error(`[webhook] No user_id found in one-time payment session ${session.id} metadata`);
            break;
          }
          
          if (!creditsStr) {
            console.error(`[webhook] No usage_credits found in one-time payment session ${session.id} metadata`);
            break;
          }
          
          const credits = parseInt(creditsStr, 10);
          if (isNaN(credits) || credits <= 0) {
            console.error(`[webhook] Invalid usage_credits in session ${session.id}: ${creditsStr}`);
            break;
          }
          
          // Check idempotency to prevent duplicate processing
          if (await subscriptionService.isSessionProcessed(session.id)) {
            console.log(`[webhook] Session ${session.id} already processed, skipping`);
            break;
          }
          
          // For one-time purchases, always ADD credits (never replace)
          await subscriptionService.handleCreditAllocation('manual', userId, credits);
          console.log(`[webhook] ✅ Added ${credits} credits to user ${userId} for one-time purchase ${session.id}`);
          
          // Mark session as processed for idempotency
          await subscriptionService.markSessionProcessed(session.id);
        }
        
        // Handle SUBSCRIPTION CHECKOUTS
        else if (session.mode === 'subscription' && session.subscription) {
          console.log(`[webhook] Processing subscription checkout: ${session.id}`);
          
          /**
           * Post-checkout subscription sync
           * 
           * Implementation notes: For subscription checkouts, retrieves the created
           * subscription from Stripe and syncs to local cache. Ensures immediate
           * availability of subscription data after successful payment.
           */
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await subscriptionService.syncSubscriptionFromWebhook(subscription);
        }
        
        // Log unhandled checkout types for debugging
        else {
          console.log(`[webhook] Unhandled checkout type - mode: ${session.mode}, payment_status: ${session.payment_status}, status: ${session.status}`);
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
