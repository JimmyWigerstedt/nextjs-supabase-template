# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build the application for production
- `npm run start` - Start production server (requires build first)
- `npm run lint` - Run ESLint for code quality checks
- `npm run add-field <fieldName> [fieldType]` - Add dynamic fields to the database (default type: VARCHAR)

### Build Testing
- `./build-temp.bat` - Test build with placeholder environment variables (Windows)
- For manual testing: Use the environment variables from `build-temp.bat` inline with npm run build

### Database Commands
- `npm run db:generate` - Generate and apply Prisma migrations in development
- `npm run db:migrate` - Deploy migrations to production database
- `npm run db:push` - Push schema changes directly to database (dev only)
- `npm run db:studio` - Open Prisma Studio for database browsing

## Architecture Overview

This is a **Next.js 14 full-stack template** built for rapid development of custom data management applications with real-time N8N workflow integration.

### Core Technology Stack
- **Next.js 14** with App Router
- **tRPC** for end-to-end type-safe APIs
- **Prisma** for database ORM
- **Supabase** for authentication and primary database  
- **PostgreSQL** (via NocoDB) for dynamic data storage
- **TailwindCSS + ShadCN UI** for styling
- **N8N** for workflow automation
- **Server-Sent Events (SSE)** for real-time updates

### Database Architecture
The template uses a **dual-database approach**:
- **Supabase Database**: Authentication, user profiles, and static data
- **Internal Database (NocoDB)**: Dynamic user data with auto-generated fields

Key concepts:
- Dynamic fields can be added without code changes using `npm run add-field`
- All user data goes into a single `userData` table with dynamic columns
- Real-time updates via webhooks and SSE connections

### Template Pattern System

The core innovation is a **field-driven component system**:

```typescript
// Define once, drives entire UI and data flow
const INPUT_FIELDS = ['customerEmail', 'orderQuantity'];      // Form inputs → N8N
const PERSISTENT_FIELDS = ['orderStatus', 'trackingNumber']; // Database storage
```

This configuration automatically generates:
- Form inputs with proper state management
- Database operations (INSERT/UPDATE)
- N8N payload structure
- UI display sections with inline editing
- Real-time update highlighting

### File Structure

#### Core Application Structure
- `src/app/` - Next.js App Router pages
  - `(auth)/` - Authentication pages (login, signup)
  - `(dashboard)/` - Main application pages (dashboard, settings, pricing)
  - `n8n-demo/` - **Reference implementation** showing the template pattern
  - `api/` - API routes (tRPC, webhooks, SSE endpoints)

#### Component Architecture
- `src/components/ui/` - ShadCN UI components and custom UI elements
- `src/components/layout/` - Layout components (AppHeader, etc.)
- `src/server/api/` - tRPC router definitions and business logic
- `src/trpc/` - tRPC client/server configuration

#### Key Integration Files
- `src/env.js` - Environment validation (includes N8N, Stripe, database configs)
- `src/lib/` - Utility functions (payments, SSE, database helpers)
- `scripts/add-field.js` - Dynamic field addition script
- `prisma/schema.prisma` - Database schema (minimal - most data is dynamic)

## Development Patterns

### Creating New Pages
1. **Copy the template**: `cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx`
2. **Define your fields**:
   ```typescript
   const INPUT_FIELDS = ['your', 'form', 'fields'];
   const PERSISTENT_FIELDS = ['your', 'database', 'fields'];
   ```
3. **Add database columns**: `npm run add-field fieldName` for each PERSISTENT_FIELD
4. **Customize labels and validation** in the UI sections
5. **Test integration** with N8N workflows

### N8N Integration Flow
1. **User submits form** → tRPC sends INPUT_FIELDS to N8N webhook
2. **N8N processes data** → Updates database directly with results
3. **N8N sends webhook** → `/api/webhooks/internal-updated` with updatedFields array
4. **Real-time UI updates** → SSE triggers field highlighting and data refresh

### Environment Variables
Required environment variables (defined in `src/env.js`):
- `DATABASE_URL` - Supabase database connection
- `INTERNAL_DATABASE_URL` - NocoDB database connection
- `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, `N8N_TIMEOUT` - N8N integration
- `NC_SCHEMA` - NocoDB schema name
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payment processing
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase client

## Testing and Validation

### Common Development Tasks
- **Test builds**: Always run `npm run build` before deploying
- **Lint code**: Run `npm run lint` to catch issues
- **Check types**: TypeScript compilation happens during build
- **Database sync**: Use `npm run db:push` in development, `npm run db:migrate` in production

### N8N Integration Testing
1. Verify webhook endpoints are accessible
2. Test payload structure matches expected format
3. Confirm database updates trigger real-time UI changes
4. Validate error handling for failed workflows

## Key Files for Customization

When adapting this template:
- **Start with**: `src/app/n8n-demo/client-page.tsx` (reference implementation)
- **Configure**: Field arrays and validation logic
- **Extend**: `src/server/api/routers/internal.ts` for custom business logic
- **Style**: Components inherit from ShadCN UI system with Tailwind classes

The template is designed for **rapid prototyping** while maintaining **production-ready** patterns for authentication, real-time updates, type safety, and workflow integration.