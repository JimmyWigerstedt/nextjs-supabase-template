// ==========================================
// TEMPLATE: Dynamic Field Router
// ==========================================
// This router handles any field names without code modifications.
// After implementing the flexibility changes, adding new fields
// requires only database schema updates - no backend code changes.
//
// DYNAMIC CAPABILITIES:
// - updateUserData: Accepts any field names as input
// - getUserData: Returns all user fields dynamically  
// - sendToN8n: Forwards any fields to n8n workflows
// - All SQL operations handle field names dynamically
//
// CREDITS SYSTEM:
// - usage_credits are ADDITIVE and NEVER EXPIRE
// - At signup: Add initial credits
// - At subscription renewal: Add credits (don't replace)
// - One-time bundles: Add credits to existing total
// - Credits accumulate over time and persist indefinitely
// ==========================================

import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { internalDb } from "~/server/internal-db";
import { env } from "~/env";

// Type for user data from database - now flexible for any fields
type UserData = {
  UID: string;
  created_at?: string;
  updated_at?: string;
} & Record<string, string | undefined>;

export const internalRouter = createTRPCRouter({
  testConnection: authorizedProcedure.query(async () => {
    console.log('[testConnection] Testing database connection...');
    let client;
    try {
      client = await internalDb.connect();
      console.log('[testConnection] Successfully connected to database');
      
      // Test basic connectivity
      const timeResult = await client.query('SELECT NOW() as current_time');
      console.log('[testConnection] Time query successful:', timeResult.rows[0]);
      
      // Get detailed database info
      const dbInfo = await client.query(`
        SELECT 
          current_database() as database_name,
          current_user as database_user,
          version() as postgres_version,
          inet_server_addr() as server_address,
          inet_server_port() as server_port
      `);
      console.log('[testConnection] Database info:', dbInfo.rows[0]);
      
      // Check if userData table exists and get its structure
      const tableInfo = await client.query(`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = 'userData'
        ORDER BY ordinal_position
      `, [env.NC_SCHEMA]);
      console.log('[testConnection] Table structure:', tableInfo.rows);
      
      return {
        success: true,
        connectionInfo: dbInfo.rows[0] as Record<string, unknown>,
        tableStructure: tableInfo.rows as Record<string, unknown>[],
        testTime: timeResult.rows[0] as Record<string, unknown>,
        databaseUrl: env.INTERNAL_DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      };
    } catch (error) {
      console.error('[testConnection] Database connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        databaseUrl: env.INTERNAL_DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      };
    } finally {
      if (client) {
        client.release();
        console.log('[testConnection] Database client released');
      }
    }
  }),

  debugDatabase: authorizedProcedure.query(async ({ ctx }) => {
    const client = await internalDb.connect();
    try {
      // Test basic connection
      await client.query('SELECT NOW()');
      
      // Get database connection info
      const dbInfo = await client.query(`
        SELECT 
          current_database() as database_name,
          current_user as database_user,
          inet_server_addr() as server_address,
          inet_server_port() as server_port
      `);
      
      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'userData'
        );
      `, [env.NC_SCHEMA]);
      
      // Get all user data for debugging
      const allData = await client.query(`SELECT * FROM "${env.NC_SCHEMA}"."userData"`);
      
      return {
        connection: "✅ Connected",
        databaseUrl: env.INTERNAL_DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Mask credentials
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        connectionInfo: dbInfo.rows[0] as Record<string, unknown>,
        tableExists: (tableCheck.rows[0] as { exists: boolean })?.exists ? "✅ Table exists" : "❌ Table missing",
        userDataCount: allData.rows.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        allUserData: allData.rows as UserData[],
        currentUserId: ctx.supabaseUser!.id,
      };
    } catch (error) {
      console.error('Database debug failed:', error);
      return {
        connection: "❌ Failed",
        error: error instanceof Error ? error.message : String(error),
        databaseUrl: env.INTERNAL_DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Mask credentials
      };
    } finally {
      client.release();
    }
  }),

  sendToN8n: authorizedProcedure
    .input(
      z.object({
        data: z.record(z.string(), z.string()),
        workflow_id: z.string(),
        expected_results_schema: z.record(z.string(), z.string()).optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        // Get user's current usage_credits from database, initialize if not exists
        const userDataResult = await client.query(
          `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID", "email", "usage_credits") 
           VALUES ($1, $2, 0)
           ON CONFLICT ("UID") DO UPDATE SET "updated_at" = CURRENT_TIMESTAMP
           RETURNING "usage_credits"`,
          [ctx.supabaseUser!.id, ctx.supabaseUser!.email]
        );
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const userData = userDataResult.rows[0] as { usage_credits?: string | number };
        const usageCredits = userData?.usage_credits ? 
          (typeof userData.usage_credits === 'string' ? parseInt(userData.usage_credits, 10) : userData.usage_credits) : 0;
        
        // Create results record before N8N call
        const createResultsQuery = `
          INSERT INTO "${env.NC_SCHEMA}"."results" 
          ("user_id", "workflow_id", "input_data", "status", "created_at") 
          VALUES ($1, $2, $3, 'processing', CURRENT_TIMESTAMP)
          RETURNING "id"
        `;
        
        const resultsResult = await client.query(createResultsQuery, [
          ctx.supabaseUser!.id,
          input.workflow_id,
          JSON.stringify(input.data)
        ]);
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const resultsRecord = resultsResult.rows[0] as { id: string };
        const resultsId = resultsRecord.id;
        
        console.log(`[sendToN8n] Created results record ${resultsId} for user ${ctx.supabaseUser!.id}`);
        
        // Enhanced N8N payload with results ID and expected schema
        const payload = {
          user_id: ctx.supabaseUser!.id,
          id: resultsId, // results.id for tracking this specific run
          workflow_id: input.workflow_id,
          user_email: ctx.supabaseUser!.email,
          usage_credits: usageCredits,
          data: input.data,
          expected_results_schema: input.expected_results_schema ?? {},
          action: "process",
        };

        try {
          // Send to n8n using the auth header specified by the user
          const response = await fetch(`${env.N8N_BASE_URL}/webhook/your-n8n-endpoint`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": env.N8N_WEBHOOK_SECRET,
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(`n8n request failed: ${response.status} ${response.statusText}`);
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result: Record<string, unknown> = await response.json();
          console.info(`[n8n] Payload sent successfully:`, { resultsId, payload, result });
          
          return {
            success: true,
            message: "Payload sent to n8n successfully",
            results_id: resultsId,
            data: result,
          };
        } catch (n8nError) {
          // Update results record with error if N8N call fails
          await client.query(
            `UPDATE "${env.NC_SCHEMA}"."results" 
             SET "status" = 'failed', "error_message" = $1, "completed_at" = CURRENT_TIMESTAMP,
                 "duration_ms" = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "created_at")) * 1000
             WHERE "id" = $2`,
            [n8nError instanceof Error ? n8nError.message : String(n8nError), resultsId]
          );
          throw n8nError;
        }
      } catch (error) {
        console.error('Failed to send to n8n:', error);
        throw new Error(`Failed to send to n8n: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        client.release();
      }
    }),
  getUserData: authorizedProcedure.query(async ({ ctx }) => {
    const client = await internalDb.connect();
    try {
      const result = await client.query(
        `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
        [ctx.supabaseUser!.id]
      );
      
      if (result.rows.length === 0) {
        return {
          UID: ctx.supabaseUser!.id,
        };
      }
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return result.rows[0] as UserData;
    } catch (error) {
      console.error('Failed to get user data:', error);
      throw new Error('Failed to retrieve user data');
    } finally {
      client.release();
    }
  }),

  // TEMPLATE PATTERN: Dynamic Field Updates
  // This mutation accepts any field names and values.
  // SQL operations are generated dynamically based on input fields.
  // No code changes needed when adding new database fields.
  updateUserData: authorizedProcedure
    .input(
      z.record(z.string(), z.string().optional())
    )
          .mutation(async ({ input, ctx }) => {
        const client = await internalDb.connect();
      try {
        console.log(`[updateUserData] Starting update for user ${ctx.supabaseUser!.id}`, {
          input,
          databaseUrl: env.INTERNAL_DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
        });
        
        const fields = Object.keys(input);
        const values = Object.values(input);

        if (fields.length === 0) {
          throw new Error('No fields provided for update');
        }

        // Build dynamic column list and placeholders
        const columnList = fields.map(field => `"${field}"`).join(', ');
        const placeholders = fields.map((_, index) => `$${index + 2}`).join(', ');
        const updateClauses = fields.map(field => 
          `"${field}" = COALESCE(EXCLUDED."${field}", "${env.NC_SCHEMA}"."userData"."${field}")`
        ).join(', ');

        const result = await client.query(
          `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID", ${columnList}, "updated_at") 
           VALUES ($1, ${placeholders}, CURRENT_TIMESTAMP)
           ON CONFLICT ("UID") 
           DO UPDATE SET 
             ${updateClauses},
             "updated_at" = CURRENT_TIMESTAMP
           RETURNING *`,
          [ctx.supabaseUser!.id, ...values]
        );
        
        console.log(`[updateUserData] Update successful for user ${ctx.supabaseUser!.id}`, {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          result: result.rows[0]
        });
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return result.rows[0] as UserData;
      } catch (error) {
        console.error(`[updateUserData] Failed to update user data for ${ctx.supabaseUser!.id}:`, error);
        throw new Error('Failed to update user data');
      } finally {
        client.release();
      }
    }),

  initializeUserData: authorizedProcedure.mutation(async ({ ctx }) => {
    const client = await internalDb.connect();
    try {
      // Get user email from Supabase auth
      const userEmail = ctx.supabaseUser!.email;
      
      const result = await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID", "email") 
         VALUES ($1, $2)
         ON CONFLICT ("UID") DO UPDATE SET 
           "email" = COALESCE(EXCLUDED."email", "${env.NC_SCHEMA}"."userData"."email"),
           "updated_at" = CURRENT_TIMESTAMP
         RETURNING *`,
        [ctx.supabaseUser!.id, userEmail]
      );
      
      if (result.rows.length === 0) {
        // If no rows returned, record already exists, fetch it
        const existing = await client.query(
          `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
          [ctx.supabaseUser!.id]
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return existing.rows[0] as UserData;
      }
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return result.rows[0] as UserData;
    } catch (error) {
      console.error('Failed to initialize user data:', error);
      throw new Error('Failed to initialize user data');
    } finally {
      client.release();
    }
  }),

  getWorkflowHistory: authorizedProcedure
    .input(z.object({
      workflow_id: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        let query = `
          SELECT "id", "workflow_id", "status", "created_at", "completed_at", 
                 "duration_ms", "credits_consumed", "error_message"
          FROM "${env.NC_SCHEMA}"."results" 
          WHERE "user_id" = $1
        `;
        const params: (string | number)[] = [ctx.supabaseUser!.id];
        
        if (input.workflow_id) {
          query += ` AND "workflow_id" = $${params.length + 1}`;
          params.push(input.workflow_id);
        }
        
        query += ` ORDER BY "created_at" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(input.limit, input.offset);
        
        const result = await client.query(query, params);
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return result.rows as Array<{
          id: string;
          workflow_id: string;
          status: string;
          created_at: string;
          completed_at: string | null;
          duration_ms: number | null;
          credits_consumed: number;
          error_message: string | null;
        }>;
      } catch (error) {
        console.error('Failed to get workflow history:', error);
        throw new Error('Failed to retrieve workflow history');
      } finally {
        client.release();
      }
    }),

  getRunDetails: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        const result = await client.query(
          `SELECT * FROM "${env.NC_SCHEMA}"."results" WHERE "id" = $1 AND "user_id" = $2`,
          [input.id, ctx.supabaseUser!.id]
        );
        
        if (result.rows.length === 0) {
          throw new Error('Results record not found or access denied');
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const record = result.rows[0] as {
          id: string;
          user_id: string;
          workflow_id: string;
          input_data: object;
          output_data: object | null;
          status: string;
          created_at: string;
          completed_at: string | null;
          duration_ms: number | null;
          error_message: string | null;
          credits_consumed: number;
          retry_count: number;
          parent_id: string | null;
        };
        
        return record;
      } catch (error) {
        console.error('Failed to get run details:', error);
        throw new Error('Failed to retrieve run details');
      } finally {
        client.release();
      }
    }),

  deleteRun: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const client = await internalDb.connect();
      try {
        const result = await client.query(
          `DELETE FROM "${env.NC_SCHEMA}"."results" WHERE "id" = $1 AND "user_id" = $2 RETURNING "id"`,
          [input.id, ctx.supabaseUser!.id]
        );
        
        if (result.rows.length === 0) {
          throw new Error('Results record not found or access denied');
        }
        
        console.log(`[deleteRun] Deleted results record ${input.id} for user ${ctx.supabaseUser!.id}`);
        
        return { success: true, id: input.id };
      } catch (error) {
        console.error('Failed to delete run:', error);
        throw new Error('Failed to delete run');
      } finally {
        client.release();
      }
    }),

}); 