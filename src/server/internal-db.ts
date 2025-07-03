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

// Ensure UID constraint exists without creating tables
export const ensureUidConstraintOnce = async () => {
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

// Ensure UID constraint exists on app startup
if (process.env.NODE_ENV !== 'test') {
  ensureUidConstraintOnce().catch(console.error);
} 