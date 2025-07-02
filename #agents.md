# Agents Development Guide

## Build and Testing

### Running Builds
**Always use `.\build-temp.bat` when checking for build errors** instead of `npm run build` directly.

The `build-temp.bat` file sets the required environment variables with placeholder values to allow the build to complete successfully without requiring actual database connections or API keys.

### Why Use build-temp.bat?
- Sets all required environment variables (DATABASE_URL, INTERNAL_DATABASE_URL, N8N_BASE_URL, etc.)
- Bypasses environment validation during build process
- Allows compilation checking without real database connections
- Provides consistent build environment across different machines

### Expected Build Warnings (Safe to Ignore)
- Database connection errors during page data collection (ECONNREFUSED to localhost:5432)
- SSE route dynamic server usage warnings (normal for real-time APIs)
- Browserslist outdated warnings

### Build Success Indicators
Look for these in the output:
- ✅ **Compiled successfully**
- ✅ **Linting and checking validity of types**
- ✅ **Collecting page data**
- ✅ **Generating static pages**

## Real-Time Updates Architecture

### SSE (Server-Sent Events) Implementation
The project uses SSE for real-time updates between n8n webhooks and the frontend:

1. **SSE Endpoint**: `/api/stream/user-updates` - Manages client connections
2. **Webhook Endpoint**: `/api/webhooks/internal-updated` - Receives n8n updates
3. **Utility Functions**: `src/lib/sse-utils.ts` - Shared SSE management

### Key Architecture Points
- **Global Connection Management**: Uses `global.activeSSEConnections` Map for cross-endpoint communication
- **Pending Updates**: Uses `global.pendingUpdates` Map for storing updates when clients aren't connected
- **Real-time Flow**: n8n → webhook → immediate SSE message → client updates
- **Fallback Flow**: If no active connection, stores in pending and sends on next connection

### Important Notes
- SSE utility functions must be in separate files (not in API route files) due to Next.js export restrictions
- API routes can only export HTTP methods (GET, POST, etc.)
- Use ESLint disable comments for necessary type assertions on database results

## Database Schema

### Internal Database (userData table with NocoDB Schema)
```sql
-- Schema creation
CREATE SCHEMA IF NOT EXISTS "pjo77o6pg08pd9l";

-- Table creation within schema
CREATE TABLE IF NOT EXISTS "pjo77o6pg08pd9l"."userData" (
  "UID" VARCHAR PRIMARY KEY,        -- User ID from Supabase auth
  "test1" VARCHAR,                  -- Test field 1
  "test2" VARCHAR,                  -- Test field 2
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Environment Variables Required
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/nextjs-supabase-template"
INTERNAL_DATABASE_URL="postgresql://postgres:password@localhost:5432/internal-db"
NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-key"
N8N_BASE_URL="https://placeholder-n8n-instance.railway.app"
N8N_WEBHOOK_SECRET="placeholder-secure-shared-secret-at-least-32-characters-long"
N8N_TIMEOUT=30000
NC_SCHEMA="pjo77o6pg08pd9l"
```

## Common TypeScript Issues

### Database Query Results
Use ESLint disable comments for database result type assertions:
```typescript
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
return result.rows[0] as UserData;
```

### Global Type Safety
When working with global variables, use proper type guards:
```typescript
const connections = global.activeSSEConnections ?? new Map();
```

## n8n Integration

### Payload Structure (from n8n)
```json
{
  "user_id": "string",
  "updatedFields": ["test1", "test2"],
  "newValues": { "test1": "value", "test2": "value" }
}
```

### Authentication
Webhook accepts either:
- `Bearer ${N8N_WEBHOOK_SECRET}` (production)
- `Bearer test-webhook-secret-for-demo` (testing)

## Troubleshooting

### Real-time Updates Not Working
1. Check SSE connection status in browser dev tools
2. Verify webhook receives proper authentication headers
3. Check console logs for connection management
4. Ensure `sendSSEUpdateToUser` is called from webhook

### Build Failures
1. Always use `.\build-temp.bat` first
2. Check for proper ESLint disable comments on type assertions
3. Verify API routes only export HTTP methods
4. Check for proper global type declarations

### Database Issues
1. Verify environment variables are set correctly
2. Check internal database connection string format
3. Ensure userData table schema matches TypeScript types 