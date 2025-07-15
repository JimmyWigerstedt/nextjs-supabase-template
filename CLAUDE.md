# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📚 Documentation Structure

**LLM-Optimized Documentation:**
- **README.md** - Project overview, instant orientation, quick start (190 lines)
- **TEMPLATE_GUIDE.md** - Complete field examples, adaptation process (350+ lines)  
- **DEVELOPERS.md** - Architecture details, API contracts, implementation (400+ lines)
- **docs/stripe.md** - Stripe integration specifics

**Previous Structure:** 11 files, 4,200+ lines with 70% redundancy
**Current Structure:** 4 files, 1,200+ lines, zero redundancy, LLM-optimized

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
- **`internalDb`**: Main application database - handles `userData` table with Stripe metadata AND `results` table for N8N workflow tracking

**Key Point**: Stripe integration writes to `internalDb.userData` table, N8N results stored in `internalDb.results` table.

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

### Results Table Architecture
The system uses a dedicated results table for N8N workflow tracking:
```typescript
const INPUT_FIELDS = ['field1', 'field2'];      // Form → N8N
const EXPECTED_RESULTS_SCHEMA = ['result1', 'result2']; // Expected N8N outputs
```

### N8N Integration with Run History
- App creates results record with 'running' status
- N8N processes data and updates results via webhook
- Real-time SSE updates notify UI of progress
- Complete audit trail maintained for all runs
- **Results stored in dedicated table, not userData**

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
- `src/server/api/routers/internal.ts` - **Main API router** (results table operations & dynamic field handling)
- `src/server/internal-db.ts` - **Database client & results table schema**
- `src/lib/subscription-service.ts` - **Stripe business logic**
- `src/lib/subscription-db.ts` - Database operations for Stripe
- `src/lib/stripe-product-utils.ts` - Product name resolution and feature access

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

### userData Table (User Management)
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

### results Table (N8N Workflow Tracking)
```sql
"id" UUID PRIMARY KEY                  -- Unique run identifier
"user_id" VARCHAR                      -- Foreign key to userData.UID
"workflow_id" VARCHAR                  -- N8N workflow identifier
"status" VARCHAR                       -- running, completed, failed, or custom
"input_data" JSONB                     -- Original input sent to N8N
"results" JSONB                        -- N8N workflow results
"expected_results_schema" JSONB        -- Expected output fields
"credits_used" INTEGER                 -- Credits consumed for this run
"created_at" TIMESTAMP                 -- Run start time
"updated_at" TIMESTAMP                 -- Last status update
"completed_at" TIMESTAMP               -- Run completion time
```

## Development Patterns

### Creating New Pages
1. **Copy template**: `cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx`
2. **Update field arrays**:
   ```typescript
   const INPUT_FIELDS = ['yourField1', 'yourField2'];
   const EXPECTED_RESULTS_SCHEMA = ['resultField1', 'resultField2'];
   ```
3. **Set workflow ID**: Update `workflow_id` in sendToN8n call
4. **Customize UI labels and validation**
5. **Results automatically stored in results table**

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

// Send to N8N with results tracking
const { mutate: sendToN8n } = api.internal.sendToN8n.useMutation();

// Get workflow run history
const { data: history } = api.internal.getWorkflowHistory.useQuery();

// Get specific run details
const { data: runDetails } = api.internal.getRunDetails.useQuery({ runId });

// Delete run history
const { mutate: deleteRun } = api.internal.deleteRun.useMutation();

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

// Results table state management
const [currentRunId, setCurrentRunId] = useState<string | null>(null);
const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
const [isConnected, setIsConnected] = useState(false);

// Required ref for avoiding stale closures
const currentRunIdRef = useRef<string | null>(null);
const refetchHistoryRef = useRef<(() => void) | null>(null);

// Required helper functions
const updateInputField = (fieldName: string, value: string) => {
  setInputData(prev => ({ ...prev, [fieldName]: value }));
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
  "action": "process",
  "run_id": "uuid",                    // NEW: Results table reference
  "workflow_id": "workflow_name",      // NEW: Workflow identifier
  "expected_results_schema": ["field1", "field2"] // NEW: Expected outputs
}

// N8N webhook response (required format)
{
  "run_id": "uuid",                    // NEW: Results table reference
  "status": "completed",               // NEW: Run status
  "results": { "field1": "value1" },   // NEW: Actual results
  "credits_used": 10                   // NEW: Credit consumption
}
```

### Core Files (Modify Carefully)
- `src/server/api/routers/internal.ts` - **Results table operations & dynamic SQL generation**
- `src/server/internal-db.ts` - **Results table schema & database setup**
- `src/lib/sse-utils.ts` - Global connection management
- `src/app/api/webhooks/internal-updated/route.ts` - **N8N results webhook handler**
- `src/app/api/stream/user-updates/route.ts` - SSE endpoint
- `src/app/api/stripe/webhook/route.ts` - **Stripe webhook handler** (handles credit allocation)

### Database Operations
- User ID must always be `ctx.supabaseUser!.id`
- Always use parameterized queries for dynamic fields
- Credit operations use database transactions
- **Stripe webhooks write directly to userData table**
- **N8N results stored in results table with UUID primary keys**
- **Results table ensures referential integrity with userData.UID**

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
    // NEW: Results table updates
    if (data.type === "results-updated") {
      if (data.runId === currentRunIdRef.current) {
        // Handle current run updates
        refetchHistoryRef.current?.();
      }
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

### Add New Workflow
1. Copy n8n-demo structure to new page
2. Update `INPUT_FIELDS` and `EXPECTED_RESULTS_SCHEMA` arrays
3. Set unique `workflow_id` in sendToN8n call
4. Test N8N integration with results table

### Add New Field Type (for userData)
1. `npm run add-field fieldName`
2. Update UI labels in formatFieldName function
3. **Note**: N8N results use JSONB storage, no schema changes needed

### Add New Feature Gate
1. Update featureMap in `src/lib/stripe-product-utils.ts`
2. Use `api.payments.hasFeature.useQuery()` in component

### Debug N8N Integration
1. Check results table for run history: `api.internal.getWorkflowHistory.useQuery()`
2. Inspect specific run: `api.internal.getRunDetails.useQuery({ runId })`
3. Monitor SSE updates for real-time status
4. Verify webhook payload matches expected format

This template enables rapid workflow creation with complete audit trails and real-time tracking.