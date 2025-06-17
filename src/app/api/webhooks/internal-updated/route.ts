import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { internalDb } from "~/server/internal-db";

// Store active SSE connections for live updates
const activeConnections = new Map<string, Response>();

// Declare global types for pending updates
declare global {
  // eslint-disable-next-line no-var
  var pendingUpdates: Map<string, { updatedFields: string[]; timestamp: string }> | undefined;
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
    
    // Update the database with new values (simulating n8n updating data)
    if (newValues && Object.keys(newValues).length > 0) {
      try {
        const client = await internalDb.connect();
        try {
          const updateFields = [];
          const updateValues = [];
          let paramIndex = 2; // Start from $2 since $1 is user_id
          
          if (newValues.test1 !== undefined) {
            updateFields.push(`"test1" = $${paramIndex}`);
            updateValues.push(newValues.test1);
            paramIndex++;
          }
          
          if (newValues.test2 !== undefined) {
            updateFields.push(`"test2" = $${paramIndex}`);
            updateValues.push(newValues.test2);
            paramIndex++;
          }
          
          if (updateFields.length > 0) {
            const query = `
              UPDATE "userData" 
              SET ${updateFields.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP
              WHERE "UID" = $1
            `;
            
            await client.query(query, [user_id, ...updateValues]);
            console.info(`${LOG_PREFIX} Database updated for user ${user_id}`);
          }
        } finally {
          client.release();
        }
      } catch (dbError) {
        console.error(`${LOG_PREFIX} Database update failed:`, dbError);
        // Continue processing even if DB update fails
      }
    }
    
    // Trigger live update for the specific user if they have an active connection
    const userConnection = activeConnections.get(user_id);
    if (userConnection) {
      try {
        // Note: SSE event would be sent here in a more robust implementation
        
        // Note: This is a simplified approach. In production, you'd want to use
        // a more robust system like Redis pub/sub or a proper real-time service
        console.info(`${LOG_PREFIX} Notifying user ${user_id} of updates`);
        
        // For now, we'll store the update and let the SSE endpoint handle it
        global.pendingUpdates = global.pendingUpdates ?? new Map();
        global.pendingUpdates.set(user_id, {
          updatedFields,
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