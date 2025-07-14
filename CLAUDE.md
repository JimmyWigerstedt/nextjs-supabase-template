# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands


### Build Testing
- `./build-temp.bat` - Test build with placeholder environment variables (Windows)
- For manual testing: Use the environment variables from `build-temp.bat` inline with npm run build


### Database Commands
- `npm run db:generate` - Generate and apply Prisma migrations in development
- `npm run db:migrate` - Deploy migrations to production database
- `npm run db:push` - Push schema changes directly to database (dev only)
- `npm run db:studio` - Open Prisma Studio for database browsing

## System Overview

**Next.js 14 full-stack template** with dynamic field system, N8N integration, and Stripe subscriptions.

### Core Stack
- **Next.js 14** with App Router
- **tRPC** for type-safe APIs
- **Supabase** for authentication
- **PostgreSQL** for data storage
- **Stripe** for subscriptions
- **TailwindCSS + ShadCN UI** for styling

### Two Database System (Critical)
- **`db` (Prisma)**: Supabase authentication database - handles auth.user table
- **`internalDb`**: Main application database - handles `userData` table with Stripe metadata

**Key Point**: Stripe integration writes to `internalDb.userData` table, NOT the auth database.

### Environment Variables (Reference Only)
```bash
DATABASE_URL="supabase-connection"
INTERNAL_DATABASE_URL="main-app-database"
N8N_BASE_URL="n8n-instance-url"
N8N_WEBHOOK_SECRET="webhook-auth"
STRIPE_SECRET_KEY="stripe-api-key"
STRIPE_WEBHOOK_SECRET="stripe-webhook-auth"
NC_SCHEMA="database-schema-name"
```

## Core Data Flow

### Template Pattern
All pages use this pattern:
```typescript
const INPUT_FIELDS = ['field1', 'field2'];      // Form → N8N
const PERSISTENT_FIELDS = ['result1', 'result2']; // Database storage
```

### N8N Integration (Black Box)
- App sends payload to N8N with INPUT_FIELDS
- N8N processes data and updates database
- N8N sends webhook back to trigger UI updates
- **Do not modify payload structure**

### Stripe Integration
- Local database caches subscription data for performance
- Webhooks sync changes from Stripe to local cache
- Credit system tracks usage via `usage_credits` field

## Stripe System Overview

### How Stripe Works in This App
1. **Local Cache**: Subscription data stored in `userData` table for fast access
2. **Webhook Updates**: Stripe events automatically update local cache
3. **API Fallback**: Missing data fetched from Stripe API when needed

### Stripe Database Fields (in userData table)
```sql
"stripe_customer_id" VARCHAR        -- Links to Stripe customer
"stripe_subscription_id" VARCHAR    -- Links to Stripe subscription  
"subscription_plan" VARCHAR         -- Resolved plan name for features
"subscription_status" VARCHAR       -- active, past_due, canceled, etc
"usage_credits" INTEGER             -- Credit balance from payments
```

### Stripe Webhook Flow
1. **Payment succeeds** → `invoice.payment_succeeded` → Credits allocated to user
2. **Subscription changes** → `customer.subscription.updated` → Plan/status updated
3. **Checkout completes** → `checkout.session.completed` → New subscription setup

### Credit System Rules
- **Credits allocated only when payments succeed** (not when subscriptions change)
- **Credits are additive** - they accumulate and never expire
- **Billing reasons determine behavior**:
  - Renewals: Replace credits (fresh billing period)
  - Upgrades: Add credits (prorated amount)
  - One-time purchases: Add credits

## File Structure

### Pages
- `src/app/n8n-demo/` - **Template reference implementation**
- `src/app/template-page/` - Example adaptation
- `src/app/(dashboard)/` - Main app pages
- `src/app/(auth)/` - Login/signup pages

### Core Integration
- `src/server/api/routers/internal.ts` - **Main API router** (dynamic field handling)
- `src/lib/subscription-service.ts` - **Stripe business logic**
- `src/lib/subscription-db.ts` - Database operations for Stripe
- `src/lib/stripe-product-utils.ts` - Product name resolution and feature access
- `src/server/internal-db.ts` - Database client

### Stripe Files
- `src/lib/payments/stripe.ts` - Stripe client
- `src/lib/payments/actions.ts` - tRPC payment procedures
- `src/app/api/stripe/webhook/route.ts` - **Stripe webhook handler** (updates userData)
- `src/app/(dashboard)/pricing/` - Pricing page UI

### Supporting Files
- `src/components/ui/` - UI components
- `src/components/layout/AppHeader.tsx` - Global header
- `src/lib/sse-utils.ts` - Real-time updates
- `src/app/api/` - Webhook handlers and SSE endpoints

## Database Schema

### userData Table (Main)
```sql
"UID" VARCHAR PRIMARY KEY              -- User ID from Supabase
"email" VARCHAR                        -- User email
"usage_credits" INTEGER DEFAULT 0      -- Stripe credit balance
"stripe_customer_id" VARCHAR           -- Stripe customer reference
"stripe_subscription_id" VARCHAR       -- Stripe subscription reference
"subscription_plan" VARCHAR            -- Plan name for feature access
"subscription_status" VARCHAR          -- Subscription state
"created_at" TIMESTAMP                 -- Record creation
"updated_at" TIMESTAMP                 -- Last update
-- Plus any dynamic fields added via npm run add-field
```

## Development Patterns

### Creating New Pages
1. **Copy template**: `cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx`
2. **Update field arrays**:
   ```typescript
   const INPUT_FIELDS = ['yourField1', 'yourField2'];
   const PERSISTENT_FIELDS = ['resultField1', 'resultField2'];
   ```
3. **Add database columns**: `npm run add-field resultField1` (for each PERSISTENT_FIELD)
4. **Customize UI labels and validation**

### Adding New Database Fields
```bash
# Adds VARCHAR column to userData table
npm run add-field newFieldName

# Specify type
npm run add-field newFieldName INTEGER
```

### tRPC Patterns
```typescript
// Get user data (includes Stripe metadata)
const { data: userData } = api.internal.getUserData.useQuery();

// Update any fields dynamically
const { mutate: updateUserData } = api.internal.updateUserData.useMutation();

// Send to N8N (includes usage_credits automatically)
const { mutate: sendToN8n } = api.internal.sendToN8n.useMutation();

// Stripe operations
const { data: subscription } = api.payments.getCurrentSubscription.useQuery();
const { mutate: createCheckout } = api.payments.createCheckoutSession.useMutation();
const { mutate: createPortal } = api.payments.createCustomerPortalSession.useMutation();

// Feature access control
const { data: hasFeature } = api.payments.hasFeature.useQuery({ 
  feature: 'advanced_features' 
});
```

### Component State Pattern (Copy Exactly)
```typescript
// Required state for template components
const [inputData, setInputData] = useState<Record<string, string>>(
  INPUT_FIELDS.reduce((acc, field) => {
    acc[field] = "";
    return acc;
  }, {} as Record<string, string>)
);

const [editableValues, setEditableValues] = useState<Record<string, string>>({});
const [persistentData, setPersistentData] = useState<Record<string, string>>({});

// Required helper functions
const updateInputField = (fieldName: string, value: string) => {
  setInputData(prev => ({ ...prev, [fieldName]: value }));
};

const updateEditableField = (fieldName: string, value: string) => {
  setEditableValues(prev => ({ ...prev, [fieldName]: value }));
};
```

## Critical: Do Not Modify

### API Payload Structures
```typescript
// N8N payload (required format)
{
  "user_id": "uuid",
  "user_email": "email", 
  "usage_credits": 1000,
  "data": { ...INPUT_FIELDS },
  "action": "process"
}

// N8N response (required format)
{
  "user_id": "uuid",
  "updatedFields": ["field1", "field2"]
}
```

### Core Files (Modify Carefully)
- `src/server/api/routers/internal.ts` - Dynamic SQL generation
- `src/lib/sse-utils.ts` - Global connection management
- `src/app/api/webhooks/internal-updated/route.ts` - Webhook handler
- `src/app/api/stream/user-updates/route.ts` - SSE endpoint
- `src/app/api/stripe/webhook/route.ts` - **Stripe webhook handler** (handles credit allocation)

### Database Operations
- User ID must always be `ctx.supabaseUser!.id`
- Always use parameterized queries for dynamic fields
- Credit operations use database transactions
- **Stripe webhooks write directly to userData table**

## Real-Time Updates

### SSE Connection (Copy Pattern)
```typescript
useEffect(() => {
  const eventSource = new EventSource("/api/stream/user-updates");
  eventSourceRef.current = eventSource;
  
  eventSource.onopen = () => setIsConnected(true);
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "userData-updated") {
      setLastUpdate(data.timestamp);
      void utils.internal.getUserData.invalidate();
    }
  };
  
  return () => eventSource.close();
}, []);
```

## Feature Access Control

```typescript
// Check subscription features
const { data: hasFeature } = api.payments.hasFeature.useQuery({ 
  feature: 'advanced_features' 
});

// Feature mapping in stripe-product-utils.ts
const featureMap: Record<string, string[]> = {
  'free': ['basic_features'],
  'pro': ['basic_features', 'advanced_features'],
  'enterprise': ['basic_features', 'advanced_features', 'enterprise_features'],
};
```

## Common Tasks

### Add New Field Type
1. `npm run add-field fieldName`
2. Add to PERSISTENT_FIELDS array in component
3. Update UI labels in formatFieldName function

### Add New Feature Gate
1. Update featureMap in `src/lib/stripe-product-utils.ts`
2. Use `api.payments.hasFeature.useQuery()` in component

### Add New Page
1. Copy n8n-demo structure
2. Update field arrays
3. Add database columns for persistent fields
4. Test N8N integration

This template enables rapid page creation by copying proven patterns and updating field configurations.