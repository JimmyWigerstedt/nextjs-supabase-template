import { Pool } from "pg";
import { env } from "~/env";

const createPool = () => new Pool({ connectionString: env.INTERNAL_DATABASE_URL });

const globalForPg = globalThis as unknown as {
  internalPool?: ReturnType<typeof createPool>;
};

export const internalDb = globalForPg.internalPool ?? createPool();

if (env.NODE_ENV !== "production") {
  globalForPg.internalPool = internalDb;
}
