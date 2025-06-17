import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { internalDb } from "~/server/internal-db";
import { sendSSEUpdateToUser, getPendingUpdates } from "~/lib/sse-utils";

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
    
    // Prepare update data
    const updateData = {
      updatedFields,
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
      updatedFields,
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