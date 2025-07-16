// ==========================================
// TEMPLATE: N8N Results Webhook Handler  
// ==========================================
// This webhook processes N8N workflow completion notifications.
// The handler automatically:
// - Updates results table with workflow status and results
// - Handles credit deduction with transactional safety
// - Sends real-time updates to connected users
// - Maintains complete audit trail for all workflow runs
//
// INTEGRATION REQUIREMENTS:
// - N8N must send run_id matching the original request
// - Status field indicates workflow completion state
// - Results field contains JSONB workflow output
// - Credits_used field tracks computational costs
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
    
    // Parse webhook payload for new results-based format
    const body = await request.json() as {
      id: string;
      status: string;
      credit_cost?: number;
      output_data?: Record<string, unknown>;
    };
    const { id, status, credit_cost, output_data } = body;
    
    if (!id || !status) {
      console.warn(`${LOG_PREFIX} Invalid payload structure`, { body });
      return NextResponse.json(
        { error: "Invalid payload: id and status required" },
        { status: 400 }
      );
    }
    
    console.info(`${LOG_PREFIX} Processing results update for ${id}`, {
      status,
      credit_cost,
      hasOutputData: !!output_data,
    });
    
    // Validate status and id format
    if (typeof status !== 'string' || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.warn(`${LOG_PREFIX} Invalid id or status format`, { id, status });
      return NextResponse.json(
        { error: "Invalid id format or status" },
        { status: 400 }
      );
    }

    let user_id: string | undefined;
    let workflow_id: string | undefined;

    try {
      const client = await internalDb.connect();
      try {
        // Use transaction for atomic updates
        await client.query('BEGIN');
        
        // Calculate duration and update results record
        const updateQuery = `
          UPDATE "${env.NC_SCHEMA}"."results" 
          SET "status" = $1::VARCHAR, 
              "completed_at" = CASE WHEN $1::VARCHAR IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE "completed_at" END,
              "duration_ms" = CASE WHEN $1::VARCHAR IN ('completed', 'failed') THEN 
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "created_at"))::INTEGER * 1000 
                ELSE "duration_ms" END,
              "credits_consumed" = COALESCE($2::INTEGER, "credits_consumed"),
              "output_data" = COALESCE($3::jsonb, "output_data")
          WHERE "id" = $4::UUID
          RETURNING "user_id", "workflow_id"
        `;
        
        const updateResult = await client.query(updateQuery, [
          status,
          credit_cost ?? null,
          output_data ? JSON.stringify(output_data) : null,
          id
        ]);
        
        if (updateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          console.warn(`${LOG_PREFIX} Results record not found for id ${id}`);
          return NextResponse.json(
            { error: "Results record not found" },
            { status: 404 }
          );
        }
        
        const resultsRecord = updateResult.rows[0] as { user_id: string; workflow_id: string };
        user_id = resultsRecord.user_id;
        workflow_id = resultsRecord.workflow_id;
        
        // Deduct credits from userData if credit_cost provided
        if (credit_cost && credit_cost > 0) {
          await client.query(
            `UPDATE "${env.NC_SCHEMA}"."userData" 
             SET "usage_credits" = GREATEST(0, COALESCE("usage_credits", 0) - $1),
                 "updated_at" = CURRENT_TIMESTAMP
             WHERE "UID" = $2`,
            [credit_cost, user_id]
          );
          console.info(`${LOG_PREFIX} Deducted ${credit_cost} credits from user ${user_id}`);
        }
        
        await client.query('COMMIT');
        
        console.info(`${LOG_PREFIX} Updated results record ${id} for user ${user_id}`, {
          status,
          credit_cost,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (dbError) {
      console.error(`${LOG_PREFIX} Database update failed:`, dbError);
      return NextResponse.json(
        { error: "Database update failed" },
        { status: 500 }
      );
    }
    
    // Determine SSE message type based on status
    let messageType = "result-updated";
    if (status === "completed") {
      messageType = "result-done";
    } else if (status === "failed") {
      messageType = "result-failed";
    }
    
    // Prepare results-focused update data
    const updateData = {
      type: messageType,
      id,
      status,
      workflow_id,
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
      message: `Results update processed for ${id}`,
      status,
      messageType,
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