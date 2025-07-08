import type Stripe from 'stripe';
import { handleSubscriptionChange, handleCustomerCreated, stripe } from '~/lib/payments/stripe';
import { env } from "~/env";
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  console.log(`[webhook] Received Stripe webhook: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`[webhook] Processing checkout.session.completed: ${session.id}, mode: ${session.mode}`);
        
        // If this is a subscription checkout, handle it
        if (session.mode === 'subscription' && session.subscription) {
          console.log(`[webhook] Fetching subscription ${String(session.subscription)} from checkout session`);
          // Fetch the full subscription object
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await handleSubscriptionChange(subscription);
        } else {
          console.log(`[webhook] Skipping non-subscription checkout session: ${session.id}`);
        }
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        console.log(`[webhook] Processing ${event.type}: ${subscription.id}`);
        await handleSubscriptionChange(subscription);
        break;
      
      case 'customer.created':
        const customer = event.data.object;
        console.log(`[webhook] Processing customer.created: ${customer.id}`);
        await handleCustomerCreated(customer);
        break;

      // CRITICAL: Invoice payment events
      case 'invoice.payment_succeeded':
        const successfulInvoice = event.data.object;
        console.log(`[webhook] Processing invoice.payment_succeeded: ${successfulInvoice.id}`);
        // TODO: Handle successful payment - update billing history, send receipts
        console.log(`[webhook] ⚠️ invoice.payment_succeeded handler not implemented yet`);
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log(`[webhook] Processing invoice.payment_failed: ${failedInvoice.id}`);
        // TODO: Handle failed payment - update status, send notifications, start dunning
        console.log(`[webhook] ⚠️ invoice.payment_failed handler not implemented yet`);
        break;

      // IMPORTANT: Trial management
      case 'customer.subscription.trial_will_end':
        const trialSubscription = event.data.object;
        console.log(`[webhook] Processing trial_will_end: ${trialSubscription.id}`);
        // TODO: Send trial ending notifications, conversion prompts
        console.log(`[webhook] ⚠️ trial_will_end handler not implemented yet`);
        break;

      // USEFUL: Customer management
      case 'customer.updated':
        const updatedCustomer = event.data.object;
        console.log(`[webhook] Processing customer.updated: ${updatedCustomer.id}`);
        // TODO: Sync customer data changes
        console.log(`[webhook] ⚠️ customer.updated handler not implemented yet`);
        break;

      case 'customer.deleted':
        const deletedCustomer = event.data.object;
        console.log(`[webhook] Processing customer.deleted: ${deletedCustomer.id}`);
        // TODO: Handle customer deletion, data cleanup
        console.log(`[webhook] ⚠️ customer.deleted handler not implemented yet`);
        break;

      // USEFUL: Payment method management  
      case 'payment_method.attached':
        const attachedPaymentMethod = event.data.object;
        console.log(`[webhook] Processing payment_method.attached: ${attachedPaymentMethod.id}`);
        // TODO: Update payment method availability in UI
        console.log(`[webhook] ⚠️ payment_method.attached handler not implemented yet`);
        break;

      case 'payment_method.detached':
        const detachedPaymentMethod = event.data.object;
        console.log(`[webhook] Processing payment_method.detached: ${detachedPaymentMethod.id}`);
        // TODO: Check if backup payment methods exist, send warnings
        console.log(`[webhook] ⚠️ payment_method.detached handler not implemented yet`);
        break;
      
      default:
        console.log(`[webhook] ⚠️ Unhandled event type: ${event.type}`);
    }

    console.log(`[webhook] ✅ Successfully processed ${event.type} event`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook] ❌ Error processing ${event.type} event:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
