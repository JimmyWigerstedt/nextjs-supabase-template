import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { 
  createCheckoutSession, 
  createCustomerPortalSession,
  getStripePrices,
  getStripeProducts
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

  getStripeProducts: authorizedProcedure
    .query(async () => {
      return await getStripeProducts();
    }),
}); 