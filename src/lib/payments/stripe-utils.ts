import type Stripe from 'stripe';

/**
 * Safely converts a Stripe timestamp (Unix timestamp in seconds) to a Date object
 * @param timestamp - The timestamp value from Stripe (could be number, string, or null)
 * @returns Date object or null if invalid
 */
export function convertStripeTimestamp(timestamp: unknown): Date | null {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }
  
  let timestampNumber: number;
  
  if (typeof timestamp === 'number') {
    timestampNumber = timestamp;
  } else if (typeof timestamp === 'string') {
    timestampNumber = parseInt(timestamp, 10);
  } else {
    return null;
  }
  
  // Validate the timestamp is a valid number
  if (isNaN(timestampNumber) || timestampNumber <= 0) {
    return null;
  }
  
  // Convert from Unix timestamp (seconds) to JavaScript Date (milliseconds)
  const date = new Date(timestampNumber * 1000);
  
  // Validate the resulting date is valid
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

/**
 * Timestamps extracted from a Stripe subscription
 */
export interface SubscriptionTimestamps {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date | null;
}

/**
 * Validation result for subscription timestamps
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Extracts all relevant timestamps from a Stripe subscription object
 * @param subscription - The Stripe subscription object
 * @returns SubscriptionTimestamps object with all extracted timestamps
 */
export function extractSubscriptionTimestamps(subscription: Stripe.Subscription): SubscriptionTimestamps {
  // Type-safe access to subscription properties
  // Some properties may not be directly typed in the Stripe SDK but are available at runtime
  const subscriptionRecord = subscription as unknown as Record<string, unknown>;
  
  // Try to get current period timestamps from subscription object
  let currentPeriodStart = convertStripeTimestamp(subscriptionRecord.current_period_start);
  let currentPeriodEnd = convertStripeTimestamp(subscriptionRecord.current_period_end);
  
  // If not found on subscription object, try subscription items (common for active subscriptions)
  if (!currentPeriodStart && subscription.items?.data?.[0]) {
    const firstItemRecord = subscription.items.data[0] as unknown as Record<string, unknown>;
    currentPeriodStart = convertStripeTimestamp(firstItemRecord.current_period_start);
    currentPeriodEnd = convertStripeTimestamp(firstItemRecord.current_period_end);
  }
  
  const trialStart = convertStripeTimestamp(subscriptionRecord.trial_start);
  const trialEnd = convertStripeTimestamp(subscriptionRecord.trial_end);
  const cancelAtPeriodEnd = Boolean(subscriptionRecord.cancel_at_period_end);
  const createdAt = convertStripeTimestamp(subscription.created);
  
  return {
    currentPeriodStart,
    currentPeriodEnd,
    trialStart,
    trialEnd,
    cancelAtPeriodEnd,
    createdAt
  };
}

/**
 * Validates subscription timestamps based on subscription status
 * @param timestamps - The extracted timestamps
 * @param subscriptionStatus - The subscription status
 * @returns ValidationResult with validity and any errors/warnings
 */
export function validateTimestamps(
  timestamps: SubscriptionTimestamps, 
  subscriptionStatus: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // For active subscriptions, we need valid period timestamps
  if (subscriptionStatus === 'active') {
    if (!timestamps.currentPeriodStart) {
      errors.push('Active subscription missing current_period_start');
    }
    if (!timestamps.currentPeriodEnd) {
      errors.push('Active subscription missing current_period_end');
    }
    if (timestamps.currentPeriodStart && timestamps.currentPeriodEnd) {
      if (timestamps.currentPeriodStart >= timestamps.currentPeriodEnd) {
        errors.push('current_period_start must be before current_period_end');
      }
    }
  }

  // For trialing subscriptions, we need valid trial timestamps
  if (subscriptionStatus === 'trialing') {
    if (!timestamps.trialEnd) {
      errors.push('Trialing subscription missing trial_end');
    }
    if (timestamps.trialStart && timestamps.trialEnd) {
      if (timestamps.trialStart >= timestamps.trialEnd) {
        errors.push('trial_start must be before trial_end');
      }
    }
    
    // For trialing, current period might not be set yet
    if (!timestamps.currentPeriodStart && !timestamps.trialStart) {
      warnings.push('Trialing subscription missing both current_period_start and trial_start');
    }
  }

  // General validations
  if (timestamps.createdAt && timestamps.currentPeriodStart) {
    if (timestamps.createdAt > timestamps.currentPeriodStart) {
      warnings.push('Subscription created after current period start');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gets effective period timestamps for a subscription based on its status
 * For trialing subscriptions, falls back to trial period if current period isn't set
 * @param timestamps - The extracted timestamps
 * @param subscriptionStatus - The subscription status
 * @returns Object with effective start and end dates
 */
export function getEffectivePeriod(
  timestamps: SubscriptionTimestamps, 
  subscriptionStatus: string
): { start: Date | null; end: Date | null } {
  if (subscriptionStatus === 'trialing') {
    // For trialing, use current period if available, otherwise use trial period
    const start = timestamps.currentPeriodStart ?? timestamps.trialStart;
    const end = timestamps.currentPeriodEnd ?? timestamps.trialEnd;
    return { start, end };
  }
  
  // For other statuses, use current period
  return {
    start: timestamps.currentPeriodStart,
    end: timestamps.currentPeriodEnd
  };
}

/**
 * Formats timestamps for database storage (ISO string format)
 * @param timestamps - The extracted timestamps
 * @returns Object with formatted timestamp strings for database
 */
export function formatTimestampsForDatabase(timestamps: SubscriptionTimestamps): {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
} {
  return {
    currentPeriodStart: timestamps.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: timestamps.currentPeriodEnd?.toISOString() ?? null,
    trialEnd: timestamps.trialEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: timestamps.cancelAtPeriodEnd
  };
} 