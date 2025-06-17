import type { NextRequest } from "next/server";
import { supabaseServer } from "~/util/supabase/server";
import { getActiveSSEConnections, getPendingUpdates } from "~/lib/sse-utils";

export async function GET(request: NextRequest) {
  const LOG_PREFIX = "[sse:user-updates]";
  
  try {
    // Authenticate user
    const supabase = supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    console.info(`${LOG_PREFIX} SSE connection established for user ${user.id}`);
    
    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Store connection for this user in global map
        const activeConnections = getActiveSSEConnections();
        activeConnections.set(user.id, controller);
        
        // Send initial connection confirmation
        const initialMessage = `data: ${JSON.stringify({
          type: "connection-established",
          userId: user.id,
          timestamp: new Date().toISOString(),
        })}\n\n`;
        
        controller.enqueue(new TextEncoder().encode(initialMessage));
        
        // Check for pending updates and send them immediately
        const pendingUpdates = getPendingUpdates();
        if (pendingUpdates.has(user.id)) {
          const pendingUpdate = pendingUpdates.get(user.id);
          if (pendingUpdate) {
            const updateMessage = `data: ${JSON.stringify({
              type: "userData-updated",
              updatedFields: pendingUpdate.updatedFields,
              fetchedValues: pendingUpdate.fetchedValues,
              timestamp: pendingUpdate.timestamp,
            })}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(updateMessage));
            console.info(`${LOG_PREFIX} Sent pending update to user ${user.id}`);
            
            // Clear the pending update
            pendingUpdates.delete(user.id);
          }
        }
        
        // Send periodic heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = `data: ${JSON.stringify({
              type: "heartbeat",
              timestamp: new Date().toISOString(),
            })}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(heartbeat));
          } catch (error) {
            console.warn(`${LOG_PREFIX} Heartbeat failed for user ${user.id}:`, error);
            clearInterval(heartbeatInterval);
            activeConnections.delete(user.id);
          }
        }, 30000); // 30 seconds
        
        // Handle connection cleanup
        request.signal?.addEventListener("abort", () => {
          console.info(`${LOG_PREFIX} SSE connection closed for user ${user.id}`);
          clearInterval(heartbeatInterval);
          activeConnections.delete(user.id);
          controller.close();
        });
      },
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    });
    
  } catch (error) {
    console.error(`${LOG_PREFIX} SSE setup failed:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Note: In production, you would use a more robust system like Redis pub/sub
// for handling real-time updates across multiple server instances 