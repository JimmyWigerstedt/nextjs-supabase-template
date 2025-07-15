// Declare global types for SSE connections and pending updates
declare global {
  // eslint-disable-next-line no-var
  var activeSSEConnections: Map<string, ReadableStreamDefaultController> | undefined;
  // eslint-disable-next-line no-var
  var pendingUpdates: Map<string, { 
    type: string;
    id?: string;
    status?: string;
    workflow_id?: string;
    timestamp: string;
    // Legacy support for old format
    updatedFields?: string[]; 
    fetchedValues?: Record<string, string>;
  }> | undefined;
}

// Initialize global connection maps
global.activeSSEConnections = global.activeSSEConnections ?? new Map();
global.pendingUpdates = global.pendingUpdates ?? new Map();

// Helper function to send SSE message to a specific user
export function sendSSEUpdateToUser(
  userId: string, 
  updateData: {
    type: string;
    id?: string;
    status?: string;
    workflow_id?: string;
    timestamp: string;
    // Legacy support for old format
    updatedFields?: string[];
    fetchedValues?: Record<string, string>;
  }
): boolean {
  const LOG_PREFIX = "[sse:send-update]";
  const controller = global.activeSSEConnections?.get(userId);
  
  if (controller) {
    try {
      // Support both new results-focused format and legacy userData format
      const messageData = updateData.type.startsWith("result-") ? {
        type: updateData.type,
        id: updateData.id,
        status: updateData.status,
        workflow_id: updateData.workflow_id,
        timestamp: updateData.timestamp,
      } : {
        type: "userData-updated", // Legacy format
        updatedFields: updateData.updatedFields,
        fetchedValues: updateData.fetchedValues,
        timestamp: updateData.timestamp,
      };
      
      const message = `data: ${JSON.stringify(messageData)}\n\n`;
      
      controller.enqueue(new TextEncoder().encode(message));
      console.info(`${LOG_PREFIX} Real-time update sent to user ${userId}:`, updateData.type);
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
export function getPendingUpdates(): Map<string, { 
  type: string;
  id?: string;
  status?: string;
  workflow_id?: string;
  timestamp: string;
  // Legacy support for old format
  updatedFields?: string[]; 
  fetchedValues?: Record<string, string>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return global.pendingUpdates ?? new Map();
} 