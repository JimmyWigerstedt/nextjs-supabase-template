# Internal Database Integration Setup

This document explains how to set up and use the internal database integration with n8n workflows and live updates.

## Environment Variables Required

Add these environment variables to your `.env.local` file:

```bash
# Database URLs
DATABASE_URL="your-supabase-database-url-here"
INTERNAL_DATABASE_URL="your-railway-postgresql-url-here"

# Supabase Configuration (for authentication)
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# n8n Configuration
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-secure-webhook-secret-min-32-chars"
N8N_TIMEOUT=30000
```

## Database Setup

The internal database uses PostgreSQL and automatically creates the required table:

```sql
CREATE TABLE IF NOT EXISTS "userData" (
  "UID" VARCHAR PRIMARY KEY,
  "test1" VARCHAR,
  "test2" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Architecture Overview

1. **Internal Database**: Direct read/write access for fast operations
2. **n8n Integration**: Workflows can read/write to internal database
3. **Live Updates**: Server-Sent Events (SSE) for real-time UI updates
4. **Webhook System**: n8n triggers UI updates via webhooks

## Testing the Integration

1. Navigate to `/n8n-demo` in your application
2. Use the "Data Input Section" to save data directly to the internal database
3. View current values in the "Data Display Section"
4. Test live updates using the "Webhook Testing Section"

## Production Usage

This demo provides patterns for:
- User-specific data management
- n8n workflow integration
- Real-time UI updates
- Secure webhook handling
- Type-safe database operations

Copy these patterns to build production features that require internal data storage and live updates.

## API Endpoints

- `POST /api/webhooks/internal-updated` - Webhook for n8n to trigger updates
- `GET /api/stream/user-updates` - SSE endpoint for live updates
- tRPC procedures: `internal.getUserData`, `internal.updateUserData`, `internal.initializeUserData` 