import { Pool } from "pg";
import { env } from "~/env";

const createInternalDbClient = () =>
  new Pool({
    connectionString: env.INTERNAL_DATABASE_URL,
  });

const globalForInternalDb = globalThis as unknown as {
  internalDb: Pool | undefined;
};

export const internalDb =
  globalForInternalDb.internalDb ?? createInternalDbClient();

if (env.NODE_ENV !== "production") globalForInternalDb.internalDb = internalDb;
