import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { internalDb } from "~/server/internal-db";

export const internalRouter = createTRPCRouter({
  getUserData: authorizedProcedure.query(async ({ ctx }) => {
    const client = await internalDb.connect();
    try {
      const result = await client.query(
        'SELECT * FROM "userData" WHERE "UID" = $1',
        [ctx.supabaseUser!.id]
      );
      
      if (result.rows.length === 0) {
        return {
          UID: ctx.supabaseUser!.id,
          test1: "",
          test2: "",
        };
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Failed to get user data:', error);
      throw new Error('Failed to retrieve user data');
    } finally {
      client.release();
    }
  }),

  updateUserData: authorizedProcedure
    .input(
      z.object({
        test1: z.string().optional(),
        test2: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        const result = await client.query(
          `INSERT INTO "userData" ("UID", "test1", "test2", "updatedAt") 
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT ("UID") 
           DO UPDATE SET 
             "test1" = COALESCE(EXCLUDED."test1", "userData"."test1"),
             "test2" = COALESCE(EXCLUDED."test2", "userData"."test2"),
             "updatedAt" = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            ctx.supabaseUser!.id,
            input.test1 ?? null,
            input.test2 ?? null,
          ]
        );
        
        return result.rows[0];
      } catch (error) {
        console.error('Failed to update user data:', error);
        throw new Error('Failed to update user data');
      } finally {
        client.release();
      }
    }),

  initializeUserData: authorizedProcedure.mutation(async ({ ctx }) => {
    const client = await internalDb.connect();
    try {
      const result = await client.query(
        `INSERT INTO "userData" ("UID", "test1", "test2") 
         VALUES ($1, '', '')
         ON CONFLICT ("UID") DO NOTHING
         RETURNING *`,
        [ctx.supabaseUser!.id]
      );
      
      if (result.rows.length === 0) {
        // If no rows returned, record already exists, fetch it
        const existing = await client.query(
          'SELECT * FROM "userData" WHERE "UID" = $1',
          [ctx.supabaseUser!.id]
        );
        return existing.rows[0];
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Failed to initialize user data:', error);
      throw new Error('Failed to initialize user data');
    } finally {
      client.release();
    }
  }),
}); 