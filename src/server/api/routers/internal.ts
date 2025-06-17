import { z } from "zod";
import { authorizedProcedure, createTRPCRouter } from "~/server/api/trpc";
import { internalDb } from "~/server/internal-db";
import { TRPCError } from "@trpc/server";

export const internalRouter = createTRPCRouter({
  testConnection: authorizedProcedure.query(async () => {
    try {
      const result = await internalDb.query('SELECT NOW()');
      return { success: true, timestamp: result.rows[0] };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database connection failed",
      });
    }
  }),
});
