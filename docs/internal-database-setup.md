# Internal Database Integration Setup with NocoDB

This document explains how to set up and use the unified database architecture that integrates the template app, NocoDB visual interface, and n8n workflows using the same database schema.

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

# NocoDB Integration
NC_SCHEMA="pjo77o6pg08pd9l"
```

## Unified Database Architecture

The system now uses a unified schema approach where all three systems (template app, NocoDB, and n8n) access the same database tables:

### Schema Structure
The internal database uses PostgreSQL with a dynamic schema approach:

```sql
-- Schema creation (automatically handled)
CREATE SCHEMA IF NOT EXISTS "pjo77o6pg08pd9l";

-- Table creation within the schema
CREATE TABLE IF NOT EXISTS "pjo77o6pg08pd9l"."userData" (
  "UID" VARCHAR PRIMARY KEY,
  "test1" VARCHAR,
  "test2" VARCHAR,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Benefits of Unified Architecture

1. **Single Source of Truth**: All systems use the same database tables
2. **Visual Management**: NocoDB provides UI for table structure and data viewing
3. **Programmatic Access**: Template provides API-driven data operations
4. **Workflow Automation**: n8n can read/write the same data for processing
5. **Environment Flexibility**: Schema name is configurable via `NC_SCHEMA`

## Architecture Overview

1. **Template App**: Reads/writes to `${NC_SCHEMA}.userData` via tRPC
2. **NocoDB Interface**: Manages tables in the same schema visually
3. **n8n Workflows**: Accesses the same tables by setting schema to `${NC_SCHEMA}`
4. **Live Updates**: Server-Sent Events (SSE) for real-time UI updates
5. **Webhook System**: n8n triggers UI updates via webhooks

## Database Setup

Run the initialization script to create the schema and table:

```bash
npm run db:init-internal
```

This script will:
- Create the NocoDB schema if it doesn't exist
- Create the `userData` table within the schema
- Verify the setup with a test query

## Integration Configuration

### NocoDB Setup
1. Connect NocoDB to the same database as `INTERNAL_DATABASE_URL`
2. Set the schema to the value of `NC_SCHEMA` in NocoDB
3. The `userData` table will appear in NocoDB interface for visual management

### n8n Setup
1. Configure n8n workflows to use the same database
2. Set schema in n8n database nodes to `${NC_SCHEMA}`
3. Use table name `userData` for operations

## Testing the Integration

1. Navigate to `/n8n-demo` in your application
2. Use the "Data Input Section" to save data directly to the internal database
3. View current values in the "Data Display Section"
4. Check NocoDB interface to confirm data appears there
5. Test n8n workflows to verify they can access the same data
6. Test live updates using the "Webhook Testing Section"

## Production Usage

This unified architecture provides patterns for:
- User-specific data management across all systems
- Visual database management via NocoDB
- n8n workflow integration with shared data
- Real-time UI updates
- Secure webhook handling
- Type-safe database operations
- Environment-configurable schema names

## API Endpoints

- `POST /api/webhooks/internal-updated` - Webhook for n8n to trigger updates
- `GET /api/stream/user-updates` - SSE endpoint for live updates
- tRPC procedures: `internal.getUserData`, `internal.updateUserData`, `internal.initializeUserData`

## Schema Management

### Adding New Fields
Use the script with the schema-aware approach:

```bash
# Add a new field to the userData table
node scripts/add-field.js newFieldName VARCHAR
```

The script automatically:
- Checks the correct schema (`NC_SCHEMA`)
- Adds the field to `${NC_SCHEMA}.userData`
- Makes the field available in template, NocoDB, and n8n

### Environment Flexibility
The `NC_SCHEMA` environment variable allows you to:
- Use different schemas for different environments
- Share the same database across multiple NocoDB projects
- Isolate data by environment or project while maintaining the unified architecture 