import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { subscriptionService } from "~/lib/subscription-service";
import { env } from "~/env";
import { stripe } from "~/lib/payments/stripe";

export const paymentsRouter = createTRPCRouter({
  /**
   * Create Stripe checkout session for subscription purchase
   * 
   * Implementation notes: Always creates fresh Stripe session, ensures customer exists
   * in local cache, embeds user metadata for webhook processing
   * Used by: Pricing page, subscription upgrade flows
   */
  createCheckoutSession: authorizedProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.supabaseUser!;
      
      // Ensure we have a Stripe customer
      const customerId = await subscriptionService.ensureStripeCustomer(user.id, user.email!);
      
      // Create simple checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: input.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${env.BASE_URL}/dashboard?checkout=success`,
        cancel_url: `${env.BASE_URL}/pricing`,
        customer: customerId,
        metadata: {
          user_id: user.id,
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
          },
        },
      });

      return { url: session.url! };
    }),

  /**
   * Create Stripe customer portal session for subscription management
   * 
   * Implementation notes: Always creates fresh portal session from Stripe API,
   * requires existing customer_id from local cache
   * Used by: Dashboard subscription management, billing page redirects
   */
  createCustomerPortalSession: authorizedProcedure
    .mutation(async ({ ctx }) => {
      const user = ctx.supabaseUser!;
      const returnUrl = `${env.BASE_URL}/dashboard`;
      
      const portalUrl = await subscriptionService.createPortalSession(user.id, returnUrl);
      
      return { url: portalUrl };
    }),

  /**
   * Retrieve active subscription using cache-first strategy with API fallback
   * 
   * Implementation notes: Uses complex cache-first logic with Stripe API fallback.
   * May trigger local cache updates during retrieval process.
   * Used by: Subscription display components, billing status checks
   */
  getCurrentSubscription: authorizedProcedure
    .query(async ({ ctx }) => {
      const user = ctx.supabaseUser!;
      const subscription = await subscriptionService.getActiveSubscription(user.id);
      
      return subscription;
    }),

  /**
   * Feature access authorization check with cache-first strategy
   * 
   * Implementation notes: Checks local subscription plan first, falls back to
   * Stripe API if missing, includes automatic plan resolution and cache updates
   * Used by: Component authorization, API endpoint protection
   */
  hasFeature: authorizedProcedure
    .input(z.object({ feature: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = ctx.supabaseUser!;
      const hasAccess = await subscriptionService.hasFeature(user.id, input.feature);
      
      return { hasAccess };
    }),

  /**
   * Retrieve active Stripe prices with product information
   * 
   * Implementation notes: Always fetches fresh pricing data from Stripe API
   * with product expansion for complete pricing display
   * Used by: Pricing page, subscription upgrade options
   */
  getStripePrices: authorizedProcedure
    .query(async () => {
      const prices = await stripe.prices.list({
        active: true,
        expand: ['data.product'],
        limit: 100,
      });

      return prices.data.map(price => ({
        id: price.id,
        // Handle both Product and DeletedProduct types
        product: typeof price.product === 'string' 
          ? { id: price.product, name: '', description: null }
          : ('name' in price.product ? price.product : { id: '', name: '', description: null }),
        unit_amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval,
        interval_count: price.recurring?.interval_count,
      }));
    }),
}); 