# Stripe Integration Architecture

## System Overview

**What**: A hybrid cache-first subscription management system that maintains local subscription metadata synchronized with Stripe via webhooks, with intelligent fallback to direct Stripe API calls when local data is missing or stale.

**Why**: This approach optimizes for performance (local cache hits) while maintaining data accuracy (webhook sync) and reliability (Stripe API fallback). It reduces API calls during normal operations while ensuring the system can recover from sync failures.

**Key Components**:
- **SubscriptionService**: Core business logic with cache-first, API-fallback patterns
- **subscription-db.ts**: Local metadata storage and retrieval operations  
- **stripe.ts**: Minimal Stripe client initialization
- **webhook handler**: Real-time synchronization of Stripe events to local cache
- **payment actions**: tRPC procedures for frontend subscription operations

## Data Flow

### Source of Truth
- **Stripe**: Authoritative source for subscription state, billing, and customer data
- **Local Database**: Performance cache for subscription metadata used in authorization and UI

### Synchronization Strategy
1. **Webhook-First Sync**: Stripe events (created, updated, deleted) immediately update local cache
2. **Lazy Reconciliation**: When local data is missing, system queries Stripe and updates cache
3. **Direct API Fallback**: Critical operations (portal creation, checkout) always use fresh Stripe data

### Database Schema (userData Table)
The system stores comprehensive subscription metadata in the `userData` table:
```sql
-- Stripe-related fields in userData table
"stripe_customer_id" VARCHAR,      -- Stripe customer identifier
"stripe_subscription_id" VARCHAR,  -- Stripe subscription identifier  
"subscription_plan" VARCHAR,       -- Resolved product name for feature access
"subscription_status" VARCHAR,     -- Subscription lifecycle state
"usage_credits" INTEGER DEFAULT 0  -- Current usage credits balance
```

## User ID Flow Architecture

### 1. Initial Checkout Flow
```typescript
// src/lib/payments/actions.ts - createCheckoutSession
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  client_reference_id: user.id,        // PRIMARY user identification
  metadata: {
    user_id: user.id,                   // SECONDARY user identification
  },
  subscription_data: {
    metadata: {
      user_id: user.id,                 // EMBEDDED in subscription metadata
      usage_credits: usageCredits.toString(),
    },
  },
});
```

### 2. Customer Creation Flow
```typescript
// src/lib/subscription-service.ts - ensureStripeCustomer
const customer = await stripe.customers.create({
  email,
  metadata: {
    user_id: userId,                    // EMBEDDED in customer metadata
  },
});
```

### 3. Webhook User ID Extraction Strategy
The system uses a **multi-tier fallback approach** for extracting user IDs from webhook events:

```typescript
// TIER 1: Invoice parent subscription_details metadata (most reliable)
invoice.parent?.subscription_details?.metadata?.user_id

// TIER 2: Line item parent subscription_details metadata
lineItem.parent?.subscription_details?.metadata?.user_id

// TIER 3: Direct line item metadata (for subscription line items)
lineItem.metadata?.user_id

// TIER 4: API fallback to subscription metadata (last resort)
stripe.subscriptions.retrieve(subscriptionId).metadata.user_id
```

## Webhook Body Structure & Credit Allocation

### Critical Webhook: `invoice.payment_succeeded`

#### Webhook Body Pathing for Credits
The system extracts `usage_credits` from **price-level metadata** (not product metadata):

```typescript
// PRIMARY: Fetch current subscription state (most reliable)
const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
  expand: ['items.data.price']
});

// Extract credits from PRICE metadata
for (const item of subscription.items.data) {
  const creditsStr = item.price.metadata?.usage_credits;  // KEY PATH
  const credits = parseInt(creditsStr, 10);
  totalCredits += credits;
}
```

#### Fallback Strategies for Credit Extraction
```typescript
// FALLBACK 1: Invoice parent subscription_details metadata
invoice.parent?.subscription_details?.metadata?.usage_credits

// FALLBACK 2: Line item metadata  
lineItem.metadata?.usage_credits
```

### Billing Reason Logic
The system uses `invoice.billing_reason` to determine credit allocation behavior:

```typescript
switch (billingReason) {
  case 'subscription_cycle':
    // Regular renewal - REPLACE credits (fresh billing period)
    await setUserCredits(userId, credits);
    break;
    
  case 'subscription_update':
    // Plan change - ADD credits (prorated amount)
    await addUserCredits(userId, credits);
    break;
    
  case 'subscription_create':
    // Initial signup - SET credits
    await setUserCredits(userId, credits);
    break;
    
  case 'manual':
    // Add-on purchase - ADD credits
    await addUserCredits(userId, credits);
    break;
}
```

### Idempotency Protection
```typescript
// Current: In-memory Set (development only)
private processedInvoices = new Set<string>();

// Production recommendation: Redis/Database
// await redis.set(`invoice:${invoiceId}:processed`, 'true', 'EX', 86400);
```

## Webhook Event Coverage

### Processed Events
1. **`invoice.payment_succeeded`**: Payment-first credit allocation
2. **`checkout.session.completed`**: Post-checkout subscription sync
3. **`customer.subscription.updated`**: Plan changes and status updates
4. **`customer.subscription.deleted`**: Subscription cleanup

### Webhook Event Flow
```typescript
// Event: customer.subscription.updated
await subscriptionService.syncSubscriptionFromWebhook(subscription);
// Updates: customer_id, subscription_id, plan, status (NOT credits)

// Event: invoice.payment_succeeded  
const userId = await subscriptionService.extractUserIdFromInvoice(invoice);
const credits = await subscriptionService.calculateCreditsFromInvoice(invoice);
await subscriptionService.handleCreditAllocation(billingReason, userId, credits);
// Updates: usage_credits based on billing_reason
```

## Performance Strategy

### Cache-First Operations
- **Feature Access Checks**: Check local `subscription_plan` first, query Stripe only if missing
- **Subscription Display**: Use local cache for UI, with optional refresh from Stripe
- **User Authorization**: Fast local lookups for subscription-based access control

### Direct API Operations  
- **Customer Portal**: Always create fresh Stripe portal sessions
- **Checkout**: Direct Stripe checkout session creation
- **Subscription Retrieval**: Complex fallback logic (ID lookup → customer search → cache update)

### Fallback Logic Example
```typescript
async getActiveSubscription(userId: string) {
  // 1. Get local metadata (customer_id, subscription_id)
  const localData = await this.getLocalSubscriptionData(userId);
  
  // 2. Try direct subscription lookup if we have ID
  if (localData.stripe_subscription_id) {
    return await stripe.subscriptions.retrieve(localData.stripe_subscription_id);
  }
  
  // 3. Fallback: search customer's active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: localData.stripe_customer_id,
    status: 'active'
  });
  
  // 4. Update local cache with discovered subscription
  if (subscriptions.data.length > 0) {
    await updateMinimalSubscriptionData(userId, {
      stripe_subscription_id: subscriptions.data[0].id,
      subscription_status: subscriptions.data[0].status
    });
  }
}
```

## Extension Points

### Adding New Features
- **Feature Access Control**: Extend `checkFeatureAccess()` feature map in `subscription-service.ts`
- **Subscription Metadata**: Add new fields to `MinimalSubscriptionData` interface
- **Webhook Events**: Add new event handlers in `webhook/route.ts`

### Database Schema Changes
- **New Fields**: Add columns to `userData` table and update TypeScript interfaces
- **Migration**: Use `checkSubscriptionFieldsExist()` to detect and handle schema changes
- **Indexing**: Consider indexes on `stripe_customer_id` and `subscription_status` for performance

### Webhook Event Handling
- **New Event Types**: Add cases to webhook switch statement
- **Event Processing**: Subscription events sync metadata only via `syncSubscriptionFromWebhook()`. Credit allocation is handled separately by `invoice.payment_succeeded` webhook using payment-first approach.
- **Error Handling**: Webhook failures don't break the system due to API fallback capabilities

### Credit Allocation Strategy
- **Payment-First Approach**: Credits are allocated only when `invoice.payment_succeeded` webhook fires
- **Subscription-State Fetching**: Credits calculated by fetching current subscription state and summing price-level metadata (not parsing invoice line items)
- **Price-Level Metadata**: Credits configured per price in Stripe (`price.metadata.usage_credits`) for granular control
- **Billing Reason Logic**: Uses `invoice.billing_reason` to determine ADD vs REPLACE credit behavior
- **Idempotency**: Invoice processing is tracked to prevent duplicate credit allocation during retries
- **Separation of Concerns**: Subscription metadata sync is separate from credit allocation for reliability
- **Robust Edge Cases**: Handles upgrades, downgrades, multi-item subscriptions, and missing metadata gracefully

## Architecture Decisions

### Why Hybrid Cache-First?
- **Performance**: Local feature checks avoid Stripe API latency
- **Reliability**: System works even if Stripe API is temporarily unavailable
- **Cost**: Reduces Stripe API calls during normal operations
- **UX**: Faster subscription-based UI updates

### Why Not Pure Stripe-First?
- **Latency**: Every feature check would require API call
- **Rate Limits**: High-traffic apps would hit Stripe rate limits
- **Availability**: Stripe downtime would break subscription features

### Why Not Pure Local Cache?
- **Data Freshness**: Local cache could become stale
- **Billing Accuracy**: Critical operations need authoritative Stripe data
- **Admin Changes**: Changes made in Stripe dashboard need to propagate

### Webhook vs Polling Trade-offs
- **Chosen**: Webhook-based sync for real-time updates
- **Alternative**: Polling would be simpler but less responsive
- **Hybrid**: Webhook primary, with periodic reconciliation jobs as backup

## System Behavior Notes

### Complex Operations Disguised as Simple
- **"Simple" Subscription Fetch**: Actually involves cache lookup → API fallback → cache update
- **"Simple" Feature Check**: Includes plan name resolution via product API calls
- **"Simple" Webhook Sync**: Requires metadata extraction and plan name resolution

### Error Handling Strategy
- **Graceful Degradation**: API failures fall back to cached data where possible
- **Logging**: Comprehensive error logging for debugging sync issues
- **Recovery**: System automatically recovers from temporary sync failures

### Data Consistency Guarantees
- **Eventually Consistent**: Local cache eventually reflects Stripe state via webhooks
- **Authoritative Fallback**: Critical operations always verify against Stripe
- **Reconciliation**: Missing local data triggers automatic sync from Stripe

## Common Integration Patterns

### Setting Up Credits in Stripe
1. Create Products in Stripe Dashboard
2. Create Prices with metadata: `usage_credits: "1000"`
3. Credits are automatically extracted during checkout and webhook processing

### Handling Plan Changes
1. User changes plan in Customer Portal
2. `customer.subscription.updated` webhook fires
3. Subscription metadata synced (plan name, status)
4. `invoice.payment_succeeded` webhook fires
5. Credits allocated based on billing_reason

This architecture prioritizes performance and reliability while maintaining data accuracy through a sophisticated synchronization strategy that handles the complexities of subscription management and credit allocation in a production environment. 