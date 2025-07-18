@echo off
set DATABASE_URL=postgresql://postgres:password@localhost:5432/nextjs-supabase-template
set INTERNAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/internal-db
set NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
set NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
set N8N_BASE_URL=https://placeholder-n8n-instance.railway.app
set N8N_WEBHOOK_SECRET=placeholder-secure-shared-secret-at-least-32-characters-long
set N8N_TIMEOUT=30000
set NC_SCHEMA=pjo77o6pg08pd9l
set STRIPE_SECRET_KEY=sk_test_placeholder_stripe_secret_key_for_testing
set STRIPE_WEBHOOK_SECRET=whsec_placeholder_stripe_webhook_secret_for_testing
set BASE_URL=http://localhost:3000
npm run build 