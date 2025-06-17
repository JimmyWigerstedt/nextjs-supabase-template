import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { internalDb } from "~/server/internal-db";
import { env } from "~/env";

// Type for user data from database
type UserData = {
  UID: string;
  test1: string;
  test2: string;
  createdAt?: string;
  updatedAt?: string;
};

export const internalRouter = createTRPCRouter({
  debugDatabase: authorizedProcedure.query(async ({ ctx }) => {
    const client = await internalDb.connect();
    try {
      // Test basic connection
      await client.query('SELECT NOW()');
      
      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'userData'
        );
      `);
      
      // Get all user data for debugging
      const allData = await client.query('SELECT * FROM "userData"');
      
      return {
        connection: "✅ Connected",
        tableExists: (tableCheck.rows[0] as { exists: boolean })?.exists ? "✅ Table exists" : "❌ Table missing",
        userDataCount: allData.rows.length,
        allUserData: allData.rows as UserData[],
        currentUserId: ctx.supabaseUser!.id,
      };
    } catch (error) {
      console.error('Database debug failed:', error);
      return {
        connection: "❌ Failed",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      client.release();
    }
  }),

  sendToN8n: authorizedProcedure
    .input(
      z.object({
        n8nDemo: z.string(),
        n8nDemo2: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Use the existing n8n client infrastructure
        const payload = {
          user_id: ctx.supabaseUser!.id,
          user_email: ctx.supabaseUser!.email,
          data: {
            n8nDemo: input.n8nDemo,
            n8nDemo2: input.n8nDemo2,
          },
          action: "process",
        };

                 // Send to n8n using the auth header specified by the user
         const response = await fetch(`${env.N8N_BASE_URL}/webhook/your-n8n-endpoint`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Auth": "x-webhook-secret",
            "x-webhook-secret": "ContentDripAuth!",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`n8n request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json() as Record<string, unknown>;
        console.info(`[n8n] Payload sent successfully:`, { payload, result });
        
        return {
          success: true,
          message: "Payload sent to n8n successfully",
          data: result,
        };
      } catch (error) {
        console.error('Failed to send to n8n:', error);
        throw new Error(`Failed to send to n8n: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
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
      
      return result.rows[0] as UserData;
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
        
        return result.rows[0] as UserData;
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
        return existing.rows[0] as UserData;
      }
      
      return result.rows[0] as UserData;
    } catch (error) {
      console.error('Failed to initialize user data:', error);
      throw new Error('Failed to initialize user data');
    } finally {
      client.release();
    }
  }),
}); 