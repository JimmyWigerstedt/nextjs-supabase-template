import Stripe from 'stripe';
import { env } from "~/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
});

// That's it! All other functions moved to SubscriptionService
// Let Stripe Customer Portal handle subscription management
// Let SubscriptionService handle data fetching
// Keep it brutally simple! 