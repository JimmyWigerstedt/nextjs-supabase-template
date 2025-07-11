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

### Data Storage Pattern
Despite "minimal" claims in comments, the system stores comprehensive subscription metadata:
- `stripe_customer_id`: Stripe customer identifier
- `stripe_subscription_id`: Stripe subscription identifier  
- `subscription_plan`: Resolved product name for feature access control
- `subscription_status`: Subscription lifecycle state

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

This architecture prioritizes performance and reliability while maintaining data accuracy through a sophisticated synchronization strategy that is far more complex than the inline comments suggest. 