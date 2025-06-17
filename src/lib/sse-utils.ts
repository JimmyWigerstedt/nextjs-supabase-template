// Declare global types for SSE connections and pending updates
declare global {
  // eslint-disable-next-line no-var
  var activeSSEConnections: Map<string, ReadableStreamDefaultController> | undefined;
  // eslint-disable-next-line no-var
  var pendingUpdates: Map<string, { 
    updatedFields: string[]; 
    fetchedValues: Record<string, string>;
    timestamp: string;
  }> | undefined;
}

// Initialize global connection maps
global.activeSSEConnections = global.activeSSEConnections ?? new Map();
global.pendingUpdates = global.pendingUpdates ?? new Map();

// Helper function to send SSE message to a specific user
export function sendSSEUpdateToUser(
  userId: string, 
  updateData: {
    updatedFields: string[];
    fetchedValues: Record<string, string>;
    timestamp: string;
  }
): boolean {
  const LOG_PREFIX = "[sse:send-update]";
  const controller = global.activeSSEConnections?.get(userId);
  
  if (controller) {
    try {
      const message = `data: ${JSON.stringify({
        type: "userData-updated",
        updatedFields: updateData.updatedFields,
        fetchedValues: updateData.fetchedValues,
        timestamp: updateData.timestamp,
      })}\n\n`;
      
      controller.enqueue(new TextEncoder().encode(message));
      console.info(`${LOG_PREFIX} Real-time update sent to user ${userId}`);
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to send update to user ${userId}:`, error);
      // Remove broken connection
      global.activeSSEConnections?.delete(userId);
      return false;
    }
  } else {
    console.info(`${LOG_PREFIX} No active connection for user ${userId}, storing as pending`);
    return false;
  }
}

// Helper to get active SSE connections (for management)
export function getActiveSSEConnections(): Map<string, ReadableStreamDefaultController> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return global.activeSSEConnections ?? new Map();
}

// Helper to get pending updates (for management)
export function getPendingUpdates(): Map<string, { updatedFields: string[]; fetchedValues: Record<string, string>; timestamp: string; }> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return global.pendingUpdates ?? new Map();
} 