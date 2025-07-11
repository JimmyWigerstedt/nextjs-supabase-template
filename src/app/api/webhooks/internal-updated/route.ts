// ==========================================
// TEMPLATE: Dynamic Webhook Handler  
// ==========================================
// This webhook processes n8n completion notifications.
// The handler automatically:
// - Accepts any field names in updatedFields array
// - Fetches current database values for those fields
// - Sends real-time updates to connected users
// - Handles offline users with pending update storage
//
// INTEGRATION REQUIREMENTS:
// - n8n must send user_id matching the original request
// - updatedFields must be array of valid database column names
// - Handler fetches and forwards current database values
// ==========================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { internalDb } from "~/server/internal-db";
import { sendSSEUpdateToUser, getPendingUpdates } from "~/lib/sse-utils";

export async function POST(request: NextRequest) {
  const LOG_PREFIX = "[webhook:internal-updated]";
  
  try {
    console.info(`${LOG_PREFIX} Webhook received`);
    
    // Verify webhook secret
    const authHeader = request.headers.get("x-webhook-secret");
    const expectedSecret = env.N8N_WEBHOOK_SECRET;
    
    if (authHeader !== expectedSecret) {
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
    };
    const { user_id, updatedFields } = body;
    
    if (!user_id || !Array.isArray(updatedFields)) {
      console.warn(`${LOG_PREFIX} Invalid payload structure`, { body });
      return NextResponse.json(
        { error: "Invalid payload: user_id and updatedFields required" },
        { status: 400 }
      );
    }
    
    console.info(`${LOG_PREFIX} Processing update for user ${user_id}`, {
      updatedFields,
    });
    
    // Validate updatedFields format
    if (!Array.isArray(updatedFields) || updatedFields.some(field => typeof field !== 'string')) {
      console.warn(`${LOG_PREFIX} Invalid updatedFields format`, { updatedFields });
      return NextResponse.json(
        { error: "updatedFields must be an array of strings" },
        { status: 400 }
      );
    }

    // Filter out potentially dangerous field names
    const safeFields = updatedFields.filter(field => 
      /^[a-zA-Z][a-zA-Z0-9_]*$/.test(field) && // Valid identifier
      !['UID', 'created_at', 'updated_at'].includes(field) // Not system fields
    );

    if (safeFields.length === 0) {
      console.warn(`${LOG_PREFIX} No valid fields to update`, { updatedFields });
      return NextResponse.json(
        { error: "No valid fields provided" },
        { status: 400 }
      );
    }

    // Fetch current values from database (n8n already updated the database)
    const fetchedValues: Record<string, string> = {};
    try {
      const client = await internalDb.connect();
      try {
        const result = await client.query(
          `SELECT * FROM "${env.NC_SCHEMA}"."userData" WHERE "UID" = $1`,
          [user_id]
        );
        
        if (result.rows.length > 0) {
          const userData = result.rows[0] as Record<string, unknown>;
          // Extract ALL requested fields dynamically
          for (const field of safeFields) {            
            fetchedValues[field] = String(userData[field] ?? '');
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
    
    // Prepare update data
    const updateData = {
      updatedFields: safeFields,
      fetchedValues,
      timestamp: new Date().toISOString(),
    };
    
    // Try to send real-time update immediately
    const sentRealTime = sendSSEUpdateToUser(user_id, updateData);
    
    if (!sentRealTime) {
      // If no active connection, store as pending update
      console.info(`${LOG_PREFIX} No active SSE connection, storing as pending update for user ${user_id}`);
      const pendingUpdates = getPendingUpdates();
      pendingUpdates.set(user_id, updateData);
    } else {
      console.info(`${LOG_PREFIX} Real-time update sent successfully to user ${user_id}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Update processed for user ${user_id}`,
      updatedFields: safeFields,
      sentRealTime,
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