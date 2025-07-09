import Stripe from 'stripe';
import { env } from "~/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
});

/**
 * Stripe client initialization - minimal entry point for complex subscription system
 * 
 * Architecture notes: While this file is simple, it serves a sophisticated hybrid cache-first 
 * system with webhook synchronization. The actual complexity lives in:
 * - SubscriptionService: Cache-first operations with Stripe API fallback
 * - subscription-db: Local metadata storage and synchronization
 * - webhook handlers: Real-time event processing for cache updates
 * 
 * See docs/stripe.md for complete architectural overview.
 */ 