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
      
      // Fetch price to get usage credits from price metadata
      const price = await stripe.prices.retrieve(input.priceId);
      
      // Extract usage credits from price metadata (not product metadata)
      let usageCredits = 0;
      const creditsMetadata = price.metadata?.usage_credits;
      if (creditsMetadata) {
        const credits = parseInt(creditsMetadata, 10);
        // Handle invalid string values that result in NaN
        usageCredits = isNaN(credits) ? 0 : credits;
      }
      
      // Create checkout session with usage credits in metadata
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: input.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${env.BASE_URL}/pricing?checkout=success`,
        cancel_url: `${env.BASE_URL}/pricing`,
        customer: customerId,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            usage_credits: usageCredits.toString(),
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
   * Retrieve active Stripe prices with product information and price metadata
   * 
   * Implementation notes: Always fetches fresh pricing data from Stripe API
   * with product expansion for complete pricing display. Now includes price metadata
   * to support credit allocation display from price-level configuration.
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
        metadata: price.metadata, // Include price metadata for credit display
      }));
    }),

  /**
   * Retrieve one-time purchase products and their prices
   * 
   * Implementation notes: Fetches products with type 'one_time' and their associated prices
   * for credit bundle purchases. Organizes by product with all price variants.
   * Used by: Pricing page one-time purchase section
   */
  getOneTimeProducts: authorizedProcedure
    .query(async () => {
      // Get all one-time products (like "Credit Bundle")
      const products = await stripe.products.list({
        active: true,
        type: 'service', // Credit bundles are service type products
        limit: 100,
      });

      // For each product, get all its active prices
      const productWithPrices = await Promise.all(
        products.data.map(async (product) => {
          const prices = await stripe.prices.list({
            active: true,
            product: product.id,
            expand: ['data.product'],
          });

          // Filter out recurring prices (we only want one-time prices)
          const oneTimePrices = prices.data.filter(price => !price.recurring);

          return {
            id: product.id,
            name: product.name,
            description: product.description,
            prices: oneTimePrices.map(price => ({
              id: price.id,
              unit_amount: price.unit_amount,
              currency: price.currency,
              metadata: price.metadata,
            }))
          };
        })
      );

      // Filter out products with no one-time prices
      const filteredProducts = productWithPrices.filter(product => product.prices.length > 0);
      
      // Temporary debugging
      console.log('[getOneTimeProducts] Raw products fetched:', products.data.length);
      console.log('[getOneTimeProducts] Products with prices:', productWithPrices.length);
      console.log('[getOneTimeProducts] Final filtered products:', filteredProducts.length);
      console.log('[getOneTimeProducts] Final products data:', JSON.stringify(filteredProducts, null, 2));
      
      return filteredProducts;
    }),

  /**
   * Create Stripe checkout session for one-time purchase
   * 
   * Implementation notes: Creates checkout session with payment mode for one-time purchases.
   * Embeds user metadata and credit information for webhook processing.
   * Used by: One-time purchase flows (credit bundles)
   */
  createOneTimeCheckoutSession: authorizedProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.supabaseUser!;
      
      // Ensure we have a Stripe customer
      const customerId = await subscriptionService.ensureStripeCustomer(user.id, user.email!);
      
      // Fetch price to get usage credits from price metadata
      const price = await stripe.prices.retrieve(input.priceId);
      
      // Extract usage credits from price metadata
      let usageCredits = 0;
      const creditsMetadata = price.metadata?.usage_credits;
      if (creditsMetadata) {
        const credits = parseInt(creditsMetadata, 10);
        usageCredits = isNaN(credits) ? 0 : credits;
      }
      
      // Create checkout session for one-time payment
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: input.priceId,
            quantity: 1,
          },
        ],
        mode: 'payment', // One-time payment mode
        success_url: `${env.BASE_URL}/pricing?checkout=success&type=one-time`,
        cancel_url: `${env.BASE_URL}/pricing`,
        customer: customerId,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          purchase_type: 'one-time',
          usage_credits: usageCredits.toString(),
        },
        payment_intent_data: {
          metadata: {
            user_id: user.id,
            purchase_type: 'one-time',
            usage_credits: usageCredits.toString(),
          },
        },
      });

      return { url: session.url! };
    }),
}); 