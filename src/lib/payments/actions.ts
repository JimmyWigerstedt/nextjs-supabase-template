import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { 
  createCheckoutSession, 
  createCustomerPortalSession,
  getStripePrices,
  getStripeProducts,
  getOrganizedStripePrices,
  getCurrentSubscription,
  compareSubscriptionPrices,
  upgradeSubscription,
  scheduleSubscriptionChange,
  previewSubscriptionChange
} from './stripe';

export const paymentsRouter = createTRPCRouter({
  createCheckoutSession: authorizedProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ input }) => {
      const checkoutUrl = await createCheckoutSession({ priceId: input.priceId });
      return { url: checkoutUrl };
    }),

  createCustomerPortalSession: authorizedProcedure
    .mutation(async ({ ctx }) => {
      const session = await createCustomerPortalSession(ctx.supabaseUser!.id);
      return { url: session.url };
    }),

  getStripePrices: authorizedProcedure
    .query(async () => {
      return await getStripePrices();
    }),

  getOrganizedStripePrices: authorizedProcedure
    .query(async () => {
      return await getOrganizedStripePrices();
    }),

  getStripeProducts: authorizedProcedure
    .query(async () => {
      return await getStripeProducts();
    }),

  // Enhanced subscription management procedures
  getCurrentSubscription: authorizedProcedure
    .query(async ({ ctx }) => {
      return await getCurrentSubscription(ctx.supabaseUser!.id);
    }),

  getSubscriptionComparison: authorizedProcedure
    .input(z.object({ targetPriceId: z.string() }))
    .query(async ({ input, ctx }) => {
      return await compareSubscriptionPrices(ctx.supabaseUser!.id, input.targetPriceId);
    }),

  upgradeSubscription: authorizedProcedure
    .input(z.object({ 
      newPriceId: z.string(),
      prorationBehavior: z.enum(['create_prorations', 'none']).default('create_prorations')
    }))
    .mutation(async ({ input, ctx }) => {
      return await upgradeSubscription(ctx.supabaseUser!.id, input.newPriceId, input.prorationBehavior);
    }),

  scheduleDowngrade: authorizedProcedure
    .input(z.object({ newPriceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await scheduleSubscriptionChange(ctx.supabaseUser!.id, input.newPriceId);
    }),

  previewSubscriptionChange: authorizedProcedure
    .input(z.object({ newPriceId: z.string() }))
    .query(async ({ input, ctx }) => {
      return await previewSubscriptionChange(ctx.supabaseUser!.id, input.newPriceId);
    }),
}); 