import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { internalDb } from "~/server/internal-db";

// Store active SSE connections for live updates
const activeConnections = new Map<string, Response>();

// Declare global types for pending updates
declare global {
  // eslint-disable-next-line no-var
  var pendingUpdates: Map<string, { 
    updatedFields: string[]; 
    fetchedValues: Record<string, string>;
    timestamp: string;
  }> | undefined;
}

export async function POST(request: NextRequest) {
  const LOG_PREFIX = "[webhook:internal-updated]";
  
  try {
    console.info(`${LOG_PREFIX} Webhook received`);
    
    // Verify webhook secret (for demo, we'll accept a test secret)
    const authHeader = request.headers.get("authorization");
    const expectedSecret = `Bearer ${env.N8N_WEBHOOK_SECRET}`;
    const testSecret = `Bearer test-webhook-secret-for-demo`;
    
    if (authHeader !== expectedSecret && authHeader !== testSecret) {
      console.warn(`${LOG_PREFIX} Unauthorized webhook attempt`);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Parse webhook payload
    const body = await request.json() as {
      user_id: string;
      updatedFields: string[];
      newValues?: { test1?: string; test2?: string };
    };
    const { user_id, updatedFields, newValues } = body;
    
    if (!user_id || !Array.isArray(updatedFields)) {
      console.warn(`${LOG_PREFIX} Invalid payload structure`, { body });
      return NextResponse.json(
        { error: "Invalid payload: user_id and updatedFields required" },
        { status: 400 }
      );
    }
    
            console.info(`${LOG_PREFIX} Processing update for user ${user_id}`, {
          updatedFields,
          newValues: newValues ?? {},
        });
    
    // Fetch current values from database (n8n already updated the database)
    const fetchedValues: Record<string, string> = {};
    try {
      const client = await internalDb.connect();
      try {
        const result = await client.query(
          'SELECT * FROM "userData" WHERE "UID" = $1',
          [user_id]
        );
        
        if (result.rows.length > 0) {
          const userData = result.rows[0] as { test1?: string; test2?: string };
          // Extract only the requested fields
          for (const field of updatedFields) {
            if (field === 'test1' || field === 'test2') {
              fetchedValues[field] = userData[field] ?? '';
            }
          }
          console.info(`${LOG_PREFIX} Fetched values for user ${user_id}:`, fetchedValues);
        } else {
          console.warn(`${LOG_PREFIX} No user data found for user ${user_id}`);
        }
      } finally {
        client.release();
      }
    } catch (dbError) {
      console.error(`${LOG_PREFIX} Database fetch failed:`, dbError);
      // Continue processing even if DB fetch fails
    }
    
    // Trigger live update for the specific user if they have an active connection
    const userConnection = activeConnections.get(user_id);
    if (userConnection) {
      try {
        // Note: SSE event would be sent here in a more robust implementation
        
        // Note: This is a simplified approach. In production, you'd want to use
        // a more robust system like Redis pub/sub or a proper real-time service
        console.info(`${LOG_PREFIX} Notifying user ${user_id} of updates`);
        
        // Store the fetched values for SSE endpoint
        global.pendingUpdates = global.pendingUpdates ?? new Map();
        global.pendingUpdates.set(user_id, {
          updatedFields,
          fetchedValues,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        console.error(`${LOG_PREFIX} Failed to notify user ${user_id}:`, error);
      }
    } else {
      console.info(`${LOG_PREFIX} No active connection for user ${user_id}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Update processed for user ${user_id}`,
      updatedFields,
    });
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Webhook processing failed:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Note: In production, use Redis or similar for cross-instance communication 