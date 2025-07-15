# Developer Implementation Guide

**🎯 Purpose:** Technical implementation details, architecture decisions, and API contracts for this Next.js Supabase template.

**👥 Audience:** Developers who need to understand the underlying systems, modify the architecture, or debug complex issues.

## 🏗️ System Architecture

### **Dual Database Pattern**
```
┌─────────────────────┐    ┌─────────────────────┐
│   Supabase DB       │    │   Internal DB       │
│   - auth.users      │    │   - userData        │
│   - auth.sessions   │    │   - results         │
│   - auth tokens     │    │   - audit trails    │
└─────────────────────┘    └─────────────────────┘
         │                            │
         └──────────┬───────────────────┘
                    │
            ┌───────▼────────┐
            │  Next.js App   │
            │  - tRPC APIs   │
            │  - SSE Updates │
            │  - N8N Webhooks│
            └────────────────┘
```

**Design Rationale:**
- **Supabase:** Optimized for authentication, session management, real-time auth events
- **Internal DB:** Optimized for application data, complex queries, JSONB storage
- **Separation of Concerns:** Auth failures don't impact app data, app migrations don't affect auth

### **Results Table Architecture**

**Schema Definition:**
```sql
CREATE TABLE IF NOT EXISTS "results" (
  -- Core identification
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" VARCHAR NOT NULL,
  "workflow_id" VARCHAR NOT NULL,
  
  -- Data payload
  "input_data" JSONB NOT NULL,
  "output_data" JSONB,
  
  -- Status & timing
  "status" VARCHAR NOT NULL DEFAULT 'processing',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP,
  "duration_ms" INTEGER,
  
  -- Error & credits
  "error_message" TEXT,
  "credits_consumed" INTEGER DEFAULT 0,
  
  -- Performance indexes
  INDEX("user_id"),
  INDEX("workflow_id"), 
  INDEX("status"),
  INDEX("created_at")
);
```

**Key Design Decisions:**
- **UUID Primary Keys:** Globally unique, collision-resistant, suitable for distributed systems
- **JSONB Storage:** Flexible schema for arbitrary input/output data without migrations
- **Status Tracking:** Free-text status allows workflow-specific progress updates
- **Performance Indexes:** Optimized for common query patterns (user history, workflow filtering)

## 🔄 Real-Time Update System

### **Server-Sent Events (SSE) Implementation**

**Connection Management:**
```typescript
// Global connection storage (in-memory for development)
global.activeSSEConnections = global.activeSSEConnections ?? new Map<string, ReadableStreamDefaultController>();
global.pendingUpdates = global.pendingUpdates ?? new Map<string, UpdateData>();

// Connection lifecycle
export async function GET(request: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return new Response("Unauthorized", { status: 401 });
  
  const stream = new ReadableStream({
    start(controller) {
      // Store connection for cross-endpoint communication
      global.activeSSEConnections.set(user.id, controller);
      
      // Send pending updates immediately on connection
      const pendingUpdate = global.pendingUpdates.get(user.id);
      if (pendingUpdate) {
        controller.enqueue(formatSSEMessage(pendingUpdate));
        global.pendingUpdates.delete(user.id);
      }
      
      // Heartbeat to maintain connection
      const heartbeatInterval = setInterval(() => {
        controller.enqueue(formatSSEMessage({ type: "heartbeat" }));
      }, 30000);
      
      // Cleanup on disconnect
      request.signal?.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        global.activeSSEConnections.delete(user.id);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
```

**Message Broadcasting:**
```typescript
export function sendSSEUpdateToUser(userId: string, updateData: UpdateData): boolean {
  const controller = global.activeSSEConnections?.get(userId);
  
  if (controller) {
    try {
      const message = formatSSEMessage(updateData);
      controller.enqueue(new TextEncoder().encode(message));
      return true; // Successfully sent
    } catch (error) {
      // Connection broken, remove from active connections
      global.activeSSEConnections?.delete(userId);
      return false;
    }
  } else {
    // No active connection, store as pending
    global.pendingUpdates?.set(userId, updateData);
    return false;
  }
}
```

**Production Considerations:**
- **Current:** In-memory storage suitable for single-instance development
- **Production:** Replace with Redis pub/sub for multi-instance deployment
- **Scaling:** Consider WebSocket upgrade for high-frequency updates

### **N8N Webhook Integration**

**Webhook Handler Implementation:**
```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate webhook
  const authHeader = request.headers.get("x-webhook-secret");
  if (authHeader !== env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // 2. Parse results-based payload
  const { id, status, output_data, credit_cost } = await request.json();
  
  // 3. Update results table with transaction safety
  const client = await internalDb.connect();
  try {
    await client.query('BEGIN');
    
    // Update results record
    const updateResult = await client.query(`
      UPDATE "results" 
      SET "status" = $1,
          "completed_at" = CASE WHEN $1 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE "completed_at" END,
          "duration_ms" = CASE WHEN $1 IN ('completed', 'failed') THEN 
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "created_at"))::INTEGER * 1000 
            ELSE "duration_ms" END,
          "credits_consumed" = COALESCE($2, "credits_consumed"),
          "output_data" = COALESCE($3, "output_data")
      WHERE "id" = $4
      RETURNING "user_id", "workflow_id"
    `, [status, credit_cost, JSON.stringify(output_data), id]);
    
    // Optional credit deduction
    if (credit_cost > 0) {
      await client.query(`
        UPDATE "userData" 
        SET "usage_credits" = GREATEST(0, COALESCE("usage_credits", 0) - $1)
        WHERE "UID" = $2
      `, [credit_cost, user_id]);
    }
    
    await client.query('COMMIT');
    
    // 4. Send real-time update
    sendSSEUpdateToUser(user_id, {
      type: status === 'completed' ? 'result-done' : 'result-updated',
      id,
      status,
      workflow_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## 🔧 tRPC API Implementation

### **Results Table Operations**

**Core Procedures:**
```typescript
export const internalRouter = createTRPCRouter({
  // Create workflow run and send to N8N
  sendToN8n: authorizedProcedure
    .input(z.object({
      data: z.record(z.string(), z.string()),
      workflow_id: z.string(),
      expected_results_schema: z.record(z.string(), z.string()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        // 1. Create results record
        const runId = randomUUID();
        await client.query(`
          INSERT INTO "results" ("id", "user_id", "workflow_id", "input_data", "status")
          VALUES ($1, $2, $3, $4, 'processing')
        `, [runId, ctx.supabaseUser.id, input.workflow_id, JSON.stringify(input.data)]);
        
        // 2. Send to N8N with tracking ID
        const payload = {
          user_id: ctx.supabaseUser.id,
          id: runId,
          workflow_id: input.workflow_id,
          user_email: ctx.supabaseUser.email,
          data: input.data,
          expected_results_schema: input.expected_results_schema,
          action: "process"
        };
        
        const response = await fetch(`${env.N8N_BASE_URL}/webhook/your-endpoint`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": env.N8N_WEBHOOK_SECRET
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error(`N8N request failed: ${response.status}`);
        
        return { success: true, results_id: runId };
      } finally {
        client.release();
      }
    }),

  // Get workflow execution history
  getWorkflowHistory: authorizedProcedure
    .input(z.object({
      workflow_id: z.string().optional(),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        let query = `
          SELECT "id", "workflow_id", "status", "created_at", "completed_at",
                 "duration_ms", "credits_consumed", "error_message"
          FROM "results" 
          WHERE "user_id" = $1
        `;
        const params = [ctx.supabaseUser.id];
        
        if (input.workflow_id) {
          query += ` AND "workflow_id" = $2`;
          params.push(input.workflow_id);
        }
        
        query += ` ORDER BY "created_at" DESC LIMIT $${params.length + 1}`;
        params.push(input.limit);
        
        const result = await client.query(query, params);
        return result.rows;
      } finally {
        client.release();
      }
    }),

  // Get detailed run information
  getRunDetails: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        const result = await client.query(
          `SELECT * FROM "results" WHERE "id" = $1 AND "user_id" = $2`,
          [input.id, ctx.supabaseUser.id]
        );
        
        if (result.rows.length === 0) {
          throw new Error('Results record not found');
        }
        
        return result.rows[0];
      } finally {
        client.release();
      }
    })
});
```

### **Dynamic Field Management**

**userData Table Operations:**
```typescript
// Dynamic field updates (for user profile data)
updateUserData: authorizedProcedure
  .input(z.record(z.string(), z.string().optional()))
  .mutation(async ({ input, ctx }) => {
    const client = await internalDb.connect();
    try {
      const fields = Object.keys(input);
      const values = Object.values(input);
      
      // Build dynamic SQL for any field names
      const columnList = fields.map(field => `"${field}"`).join(', ');
      const placeholders = fields.map((_, index) => `$${index + 2}`).join(', ');
      const updateClauses = fields.map(field => 
        `"${field}" = COALESCE(EXCLUDED."${field}", "userData"."${field}")`
      ).join(', ');
      
      const result = await client.query(
        `INSERT INTO "userData" ("UID", ${columnList}, "updated_at") 
         VALUES ($1, ${placeholders}, CURRENT_TIMESTAMP)
         ON CONFLICT ("UID") 
         DO UPDATE SET ${updateClauses}, "updated_at" = CURRENT_TIMESTAMP
         RETURNING *`,
        [ctx.supabaseUser.id, ...values]
      );
      
      return result.rows[0];
    } finally {
      client.release();
    }
  })
```

## 💳 Stripe Integration Architecture

### **Subscription Service Pattern**
```typescript
export class SubscriptionService {
  // Cache-first approach with Stripe API fallback
  async getActiveSubscription(userId: string): Promise<StripeSubscriptionData | null> {
    // 1. Check local cache
    const localData = await getMinimalSubscriptionData(userId);
    
    // 2. Direct subscription lookup if we have ID
    if (localData.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(localData.stripe_subscription_id);
      if (this.isActiveStatus(subscription.status)) {
        return this.formatSubscriptionData(subscription);
      }
    }
    
    // 3. Fallback: search customer's active subscriptions
    if (localData.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: localData.stripe_customer_id,
        status: 'active',
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        // Update local cache with discovered subscription
        await updateMinimalSubscriptionData(userId, {
          stripe_subscription_id: subscriptions.data[0].id
        });
        return this.formatSubscriptionData(subscriptions.data[0]);
      }
    }
    
    return null;
  }
}
```

### **Credit Allocation System**
```typescript
// Payment-first credit allocation
async handleCreditAllocation(billingReason: string, userId: string, credits: number) {
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
      
    default:
      // Unknown - default to ADD
      await addUserCredits(userId, credits);
      break;
  }
}
```

## 🗄️ Database Schema Details

### **Internal Database Setup**
```typescript
// Auto-initialization on app startup
export const ensureResultsTableOnce = async () => {
  const client = await internalDb.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "results" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" VARCHAR NOT NULL,
        "workflow_id" VARCHAR NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'processing',
        "input_data" JSONB NOT NULL,
        "output_data" JSONB,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "completed_at" TIMESTAMP,
        "duration_ms" INTEGER,
        "error_message" TEXT,
        "credits_consumed" INTEGER DEFAULT 0
      )
    `);
    
    // Performance indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_results_user_workflow" 
      ON "results"("user_id", "workflow_id", "created_at" DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_results_status" 
      ON "results"("status", "created_at") 
      WHERE "status" IN ('processing', 'failed')
    `);
  } finally {
    client.release();
  }
};
```

### **Dynamic Field Addition**
```javascript
// scripts/add-field.js
async function addField(fieldName, fieldType = 'VARCHAR') {
  const pool = new Pool({ connectionString: process.env.INTERNAL_DATABASE_URL });
  const client = await pool.connect();
  
  try {
    // Check if field exists
    const checkResult = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = 'userData' AND column_name = $2
    `, [process.env.NC_SCHEMA, fieldName]);
    
    if (checkResult.rows.length === 0) {
      // Add field to userData table
      await client.query(`
        ALTER TABLE "${process.env.NC_SCHEMA}"."userData" 
        ADD COLUMN "${fieldName}" ${fieldType}
      `);
      console.log(`✅ Added field '${fieldName}' with type ${fieldType}`);
    } else {
      console.log(`✅ Field '${fieldName}' already exists`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
```

## 🔒 Security Implementation

### **Authentication Flow**
```typescript
// Supabase user context in tRPC
export const authorizedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  
  return next({
    ctx: { supabaseUser: user }
  });
});
```

### **Webhook Security**
```typescript
// N8N webhook authentication
const authHeader = request.headers.get("x-webhook-secret");
if (authHeader !== env.N8N_WEBHOOK_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### **Database Security**
```typescript
// User isolation in all queries
const result = await client.query(
  `SELECT * FROM "results" WHERE "user_id" = $1`,
  [ctx.supabaseUser.id] // Always scope to authenticated user
);
```

## 🚀 Performance Optimizations

### **Database Connection Pooling**
```typescript
export const internalDb = new Pool({
  connectionString: env.INTERNAL_DATABASE_URL,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### **Query Optimization**
```sql
-- Efficient user workflow history query
SELECT "id", "workflow_id", "status", "created_at", "completed_at"
FROM "results" 
WHERE "user_id" = $1 AND "workflow_id" = $2
ORDER BY "created_at" DESC 
LIMIT 20;

-- Uses index: idx_results_user_workflow
```

### **SSE Connection Management**
```typescript
// Heartbeat to prevent connection timeout
const heartbeatInterval = setInterval(() => {
  controller.enqueue(formatSSEMessage({ type: "heartbeat" }));
}, 30000);

// Cleanup on disconnect to prevent memory leaks
request.signal?.addEventListener("abort", () => {
  clearInterval(heartbeatInterval);
  global.activeSSEConnections.delete(user.id);
});
```

## 🔧 Development Tools

### **Build Testing**
```bash
# Use build-temp.bat for consistent builds
./build-temp.bat

# Manual testing with placeholder env vars
INTERNAL_DATABASE_URL="postgresql://placeholder" npm run build
```

### **Database Debugging**
```typescript
// Debug endpoint for database inspection
export const debugDatabase = authorizedProcedure.query(async ({ ctx }) => {
  const client = await internalDb.connect();
  try {
    const connectionInfo = await client.query('SELECT current_database(), current_user');
    const tableInfo = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = $1
    `, [env.NC_SCHEMA]);
    
    return {
      connection: "✅ Connected",
      database: connectionInfo.rows[0],
      tables: tableInfo.rows
    };
  } finally {
    client.release();
  }
});
```

## 📊 Monitoring and Observability

### **Logging Strategy**
```typescript
// Structured logging with prefixes
console.info(`[webhook:internal-updated] Processing update for run ${id}`);
console.error(`[sse:send-update] Failed to send update to user ${userId}:`, error);
console.warn(`[subscription-service] Missing customer ID for user ${userId}`);
```

### **Error Tracking**
```typescript
// Comprehensive error context
catch (error) {
  console.error('Database operation failed:', {
    operation: 'updateResults',
    runId: id,
    userId: user_id,
    error: error.message,
    stack: error.stack
  });
  throw new Error(`Results update failed: ${error.message}`);
}
```

### **Performance Metrics**
```typescript
// Track execution duration in results table
const startTime = Date.now();
// ... processing ...
const duration = Date.now() - startTime;

await client.query(`
  UPDATE "results" 
  SET "duration_ms" = $1 
  WHERE "id" = $2
`, [duration, runId]);
```

---

**🎯 Architecture Summary:** This template uses a sophisticated dual-database architecture with real-time updates, complete audit trails, and production-ready patterns. The results table system provides comprehensive workflow tracking while maintaining flexibility for any use case through dynamic field handling and JSONB storage.