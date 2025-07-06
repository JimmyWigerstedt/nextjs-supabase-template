import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { 
  createCheckoutSession, 
  createCustomerPortalSession,
  getStripePrices,
  getStripeProducts
} from './stripe';
import { redirect } from 'next/navigation';

export const paymentsRouter = createTRPCRouter({
  createCheckoutSession: authorizedProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ input }) => {
      // This will redirect, so we don't return anything
      await createCheckoutSession({ priceId: input.priceId });
    }),

  createCustomerPortalSession: authorizedProcedure
    .mutation(async ({ ctx }) => {
      const session = await createCustomerPortalSession(ctx.supabaseUser!.id);
      redirect(session.url);
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
