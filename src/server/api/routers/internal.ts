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
      z.record(z.string(), z.string())
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Use the existing n8n client infrastructure
        const payload = {
          user_id: ctx.supabaseUser!.id,
          user_email: ctx.supabaseUser!.email,
          data: input, // Pass all input fields directly
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result: Record<string, unknown> = await response.json();
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
      const result = await client.query(
        `INSERT INTO "${env.NC_SCHEMA}"."userData" ("UID") 
         VALUES ($1)
         ON CONFLICT ("UID") DO NOTHING
         RETURNING *`,
        [ctx.supabaseUser!.id]
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
}); 