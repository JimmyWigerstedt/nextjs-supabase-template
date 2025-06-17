import { Pool } from "pg";
import { env } from "~/env";

const createInternalDbClient = () =>
  new Pool({
    connectionString: env.INTERNAL_DATABASE_URL,
    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

const globalForInternalDb = globalThis as unknown as {
  internalDb: ReturnType<typeof createInternalDbClient> | undefined;
};

export const internalDb = globalForInternalDb.internalDb ?? createInternalDbClient();

if (env.NODE_ENV !== "production") globalForInternalDb.internalDb = internalDb;

// Initialize userData table if it doesn't exist
export const initializeUserDataTable = async () => {
  const client = await internalDb.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "userData" (
        "UID" VARCHAR PRIMARY KEY,
        "test1" VARCHAR,
        "test2" VARCHAR,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Failed to initialize userData table:', error);
  } finally {
    client.release();
  }
};

// Initialize table on first import
initializeUserDataTable().catch(console.error); 