import { Pool } from "pg";
import { env } from "~/env";

const createInternalDbClient = () => {
  console.log('[internal-db] Creating database pool with URL:', 
    env.INTERNAL_DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
  );
  
  // Determine SSL settings based on environment and URL
  let sslConfig: boolean | { rejectUnauthorized: boolean } = false;
  
  if (env.NODE_ENV === "production") {
    sslConfig = { rejectUnauthorized: false };
  } else if (env.INTERNAL_DATABASE_URL.includes('railway') || env.INTERNAL_DATABASE_URL.includes('postgres.railway')) {
    // Railway often requires SSL even in development
    sslConfig = { rejectUnauthorized: false };
  }
  
  console.log('[internal-db] SSL configuration:', sslConfig);
  
  return new Pool({
    connectionString: env.INTERNAL_DATABASE_URL,
    ssl: sslConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
};

const globalForInternalDb = globalThis as unknown as {
  internalDb: ReturnType<typeof createInternalDbClient> | undefined;
  stripeFieldsEnsured: boolean | undefined;
};

export const internalDb = globalForInternalDb.internalDb ?? createInternalDbClient();

if (env.NODE_ENV !== "production") globalForInternalDb.internalDb = internalDb;

// Add connection event listeners for debugging
internalDb.on('connect', (_client) => {
  console.log('[internal-db] Client connected to database');
});

internalDb.on('error', (err) => {
  console.error('[internal-db] Database pool error:', err);
});

// Check if we're in a build environment where database isn't available
const isBuildEnvironment = () => {
  return (
    process.env.NODE_ENV === 'production' && 
    (process.env.VERCEL_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production')
  ) || process.env.NEXT_PHASE === 'phase-production-build';
};

// Ensure UID constraint exists without creating tables
export const ensureUidConstraintOnce = async () => {
  if (isBuildEnvironment()) {
    console.log('[internal-db] ⚠️ Skipping UID constraint check in build environment');
    return;
  }

  console.log('[internal-db] Checking UID constraint...');
  const client = await internalDb.connect();
  try {
    // Check if UID unique constraint exists
    const constraintCheck = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'userData' 
      AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      AND constraint_name ILIKE '%uid%'
    `);
    
    // Add unique constraint if it doesn't exist
    if (constraintCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "${env.NC_SCHEMA}"."userData" 
        ADD CONSTRAINT unique_uid UNIQUE ("UID")
      `);
      console.log('[internal-db] ✅ Added unique constraint to UID');
    } else {
      console.log('[internal-db] ✅ UID constraint already exists');
    }
  } catch (error) {
    // Constraint might already exist with different name, or UID is already primary key
    console.log('[internal-db] UID constraint check:', error instanceof Error ? error.message : String(error));
  } finally {
    client.release();
  }
};

// Ensure Stripe subscription fields exist - LAZY EXECUTION
export const ensureStripeFieldsOnce = async () => {
  // Check if already ensured in this process
  if (globalForInternalDb.stripeFieldsEnsured) {
    return;
  }

  if (isBuildEnvironment()) {
    console.log('[internal-db] ⚠️ Skipping Stripe fields check in build environment');
    return;
  }

  console.log('[internal-db] Checking Stripe subscription fields...');
  let client;
  
  try {
    client = await internalDb.connect();
    
    // Define the Stripe fields that should exist
    const stripeFields = [
      'stripeCustomerId',
      'stripeSubscriptionId', 
      'planName',
      'subscriptionStatus',
      'currentPeriodStart',
      'currentPeriodEnd',
      'trialEnd',
      'cancelAtPeriodEnd',
      'priceId'
    ];
    
    // Define field types for proper column creation
    const getFieldType = (fieldName: string): string => {
      switch (fieldName) {
        case 'stripeCustomerId':
        case 'stripeSubscriptionId':
        case 'planName':
        case 'subscriptionStatus':
        case 'priceId':
          return 'VARCHAR';
        case 'currentPeriodStart':
        case 'currentPeriodEnd':
        case 'trialEnd':
          return 'TIMESTAMP';
        case 'cancelAtPeriodEnd':
          return 'BOOLEAN DEFAULT FALSE';
        default:
          return 'VARCHAR';
      }
    };

    for (const field of stripeFields) {
      try {
        // Check if field exists
        const fieldCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'userData' AND column_name = $2
        `, [env.NC_SCHEMA, field]);
        
        if (fieldCheck.rows.length === 0) {
          // Field doesn't exist, add it with proper type
          const fieldType = getFieldType(field);
          await client.query(`
            ALTER TABLE "${env.NC_SCHEMA}"."userData" 
            ADD COLUMN "${field}" ${fieldType}
          `);
          console.log(`[internal-db] ✅ Added field: ${field} (${fieldType})`);
        } else {
          console.log(`[internal-db] ✅ Field already exists: ${field}`);
        }
      } catch (error) {
        console.warn(`[internal-db] ⚠️ Could not add field ${field}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // Mark as ensured for this process
    globalForInternalDb.stripeFieldsEnsured = true;
    console.log('[internal-db] ✅ Stripe fields check complete');
  } catch (error) {
    console.error('[internal-db] ❌ Stripe fields check failed:', error instanceof Error ? error.message : String(error));
    // Don't mark as ensured if it failed - allow retry on next request
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Enhanced database connection with lazy field creation
export const getInternalDbConnection = async () => {
  // Ensure Stripe fields exist on first real database use
  await ensureStripeFieldsOnce();
  
  return internalDb.connect();
};

// Only run UID constraint check at startup if not in build environment
if (process.env.NODE_ENV !== 'test' && !isBuildEnvironment()) {
  // Only run UID constraint check at startup
  ensureUidConstraintOnce().catch((error) => {
    console.warn('[internal-db] ⚠️ UID constraint check failed at startup:', error instanceof Error ? error.message : String(error));
  });
} 