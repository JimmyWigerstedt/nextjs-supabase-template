import { Pool } from "pg";
import { env } from "~/env";

// Add global flag declaration for singleton pattern
declare global {
  // eslint-disable-next-line no-var
  var fieldCreationScheduled: boolean | undefined;
}

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

// Enhanced UID constraint function with detailed logging
export const ensureUidConstraintOnce = async () => {
  console.log('[internal-db] 🔍 Checking UID constraint...');
  const client = await internalDb.connect();
  try {
    // Check if schema exists first
    const schemaCheck = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = $1
    `, [env.NC_SCHEMA]);
    
    if (schemaCheck.rows.length === 0) {
      console.log(`[internal-db] 📝 Schema "${env.NC_SCHEMA}" not found, creating...`);
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${env.NC_SCHEMA}"`);
      console.log(`[internal-db] ✅ Schema "${env.NC_SCHEMA}" created successfully`);
    } else {
      console.log(`[internal-db] ✅ Schema "${env.NC_SCHEMA}" already exists`);
    }

    // Check if userData table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = 'userData'
    `, [env.NC_SCHEMA]);
    
    if (tableCheck.rows.length === 0) {
      console.log(`[internal-db] 📝 Creating userData table...`);
      await client.query(`
        CREATE TABLE "${env.NC_SCHEMA}"."userData" (
          "UID" VARCHAR PRIMARY KEY,
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`[internal-db] ✅ userData table created successfully`);
    } else {
      console.log(`[internal-db] ✅ Table "userData" exists in schema "${env.NC_SCHEMA}"`);
    }
    
    // Check if UID constraint exists
    const constraintCheck = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = $1 AND table_name = 'userData' 
      AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      AND constraint_name ILIKE '%uid%'
    `, [env.NC_SCHEMA]);
    
    if (constraintCheck.rows.length === 0) {
      console.log('[internal-db] 📝 UID constraint not found, creating...');
      await client.query(`
        ALTER TABLE "${env.NC_SCHEMA}"."userData" 
        ADD CONSTRAINT unique_uid UNIQUE ("UID")
      `);
      console.log('[internal-db] ✅ UID unique constraint created successfully');
    } else {
      console.log('[internal-db] ✅ UID constraint already exists');
    }
  } catch (error) {
    console.log('[internal-db] ℹ️ UID constraint check completed with notes:', error instanceof Error ? error.message : String(error));
  } finally {
    client.release();
  }
};

// Enhanced Stripe fields function with detailed logging
export const ensureStripeFieldsOnce = async () => {
  console.log('[internal-db] 🔍 Checking Stripe subscription fields...');
  let client;
  
  try {
    client = await internalDb.connect();
    
    // Verify schema exists
    const schemaCheck = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = $1
    `, [env.NC_SCHEMA]);
    
    if (schemaCheck.rows.length === 0) {
      console.log(`[internal-db] ❌ Schema "${env.NC_SCHEMA}" not found, cannot create fields`);
      return;
    }
    
    // Verify table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = 'userData'
    `, [env.NC_SCHEMA]);
    
    if (tableCheck.rows.length === 0) {
      console.log(`[internal-db] ❌ Table "userData" not found, cannot create fields`);
      return;
    }
    
    console.log(`[internal-db] ✅ Schema and table verified, proceeding with field creation...`);
    
    const stripeFields = [
      'stripe_customer_id',
      'stripe_subscription_id', 
      'subscription_plan',
      'subscription_status',
      'usage_credits',
      'email'
    ];
    
    // Field type mapping
    const getFieldType = (fieldName: string): string => {
      switch (fieldName) {
        case 'usage_credits':
          return 'INTEGER DEFAULT 0';
        default:
          return 'VARCHAR';
      }
    };

    let fieldsCreated = 0;
    let fieldsExisted = 0;
    
    for (const field of stripeFields) {
      try {
        // Check if field exists
        const fieldCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'userData' AND column_name = $2
        `, [env.NC_SCHEMA, field]);
        
        if (fieldCheck.rows.length === 0) {
          const fieldType = getFieldType(field);
          console.log(`[internal-db] 📝 Creating field: ${field} (${fieldType})`);
          
          await client.query(`
            ALTER TABLE "${env.NC_SCHEMA}"."userData" 
            ADD COLUMN "${field}" ${fieldType}
          `);
          
          console.log(`[internal-db] ✅ Field created: ${field}`);
          fieldsCreated++;
        } else {
          console.log(`[internal-db] ✅ Field already exists: ${field}`);
          fieldsExisted++;
        }
      } catch (error) {
        console.warn(`[internal-db] ⚠️ Could not process field ${field}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    console.log(`[internal-db] 📊 Stripe fields summary: ${fieldsCreated} created, ${fieldsExisted} already existed`);
    console.log('[internal-db] ✅ Stripe fields check completed');
    
  } catch (error) {
    console.error('[internal-db] ❌ Stripe fields check failed:', error instanceof Error ? error.message : String(error));
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Run field creation 2 minutes after deployment with singleton pattern
// This ensures the app is fully running and database is accessible
if (process.env.NODE_ENV !== 'test' && 
    process.env.NEXT_PHASE !== 'phase-production-build' && 
    !global.fieldCreationScheduled) {
  global.fieldCreationScheduled = true;
  console.log('[internal-db] 🚀 Scheduling field creation for 2 minutes after deployment...');
  
  setTimeout(() => {
    console.log('[internal-db] ⏰ Running post-deployment field creation...');
    
    Promise.all([
      ensureUidConstraintOnce(),
      ensureStripeFieldsOnce()
    ]).then(() => {
      console.log('[internal-db] 🎉 Post-deployment field creation completed successfully!');
    }).catch((error) => {
      console.error('[internal-db] ❌ Post-deployment field creation failed:', error instanceof Error ? error.message : String(error));
    });
  }, 2 * 60 * 1000);
} else if (process.env.NODE_ENV !== 'test') {
  console.log('[internal-db] ⏭️ Field creation already scheduled, skipping...');
} 