"use client";
import { useState, useEffect, useRef } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";

// UserData interface for type checking
// interface UserData {
//   UID: string;
//   test1: string;
//   test2: string;
//   createdAt?: string;
//   updatedAt?: string;
// }

// Add this constant at the top of the component for easy field management during development:
const DEVELOPMENT_FIELDS = [
  'test1',
  'test2',
  'customField1',    // ✨ Demo: added without any other code changes!
  // Add new fields here during development:
  // 'userPreference',
  // 'workflowData',
];

export function N8nDemoClient() {
  const utils = clientApi.useUtils(); // ADD THIS
  const [fieldInputs, setFieldInputs] = useState<Record<string, string>>(
    DEVELOPMENT_FIELDS.reduce((acc, field) => {
      acc[field] = "";
      return acc;
    }, {} as Record<string, string>)
  );
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [showDebug, setShowDebug] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Add helper function to manage field updates:
  const updateFieldInput = (fieldName: string, value: string) => {
    setFieldInputs(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // tRPC queries and mutations
  const {
    data: userData,
    refetch: refetchUserData,
    isLoading: isLoadingData,
  } = clientApi.internal.getUserData.useQuery();

  const { mutate: updateUserData, isPending: isUpdating } = 
    clientApi.internal.updateUserData.useMutation({
      onSuccess: (_data) => {
        toast.success("Data updated successfully!");
        void refetchUserData();
        setFieldInputs(prev => 
          Object.keys(prev).reduce((acc, key) => {
            acc[key] = "";
            return acc;
          }, {} as Record<string, string>)
        );
      },
      onError: (error) => {
        toast.error(`Error: ${error.message}`);
      },
    });

  const { mutate: initializeUserData } = 
    clientApi.internal.initializeUserData.useMutation({
      onSuccess: () => {
        toast.success("User data initialized!");
        void refetchUserData();
      },
      onError: (error) => {
        toast.error(`Initialization error: ${error.message}`);
      },
    });

  const { mutate: sendToN8n, isPending: isSendingToN8n } = 
    clientApi.internal.sendToN8n.useMutation({
      onSuccess: () => {
        toast.success("Payload sent to n8n successfully! Waiting for webhook response...");
        // Clear inputs after successful send
        setFieldInputs(prev => 
          Object.keys(prev).reduce((acc, key) => {
            acc[key] = "";
            return acc;
          }, {} as Record<string, string>)
        );
      },
      onError: (error) => {
        toast.error(`n8n send failed: ${error.message}`);
      },
    });

  const { data: debugInfo, refetch: refetchDebug } = 
    clientApi.internal.debugDatabase.useQuery();

  const { 
    data: connectionTestResult, 
    refetch: testConnection, 
    isLoading: isTestingConnection 
  } = clientApi.internal.testConnection.useQuery(undefined, {
    enabled: false, // Don't run automatically
  });

  // Initialize SSE connection for live updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/user-updates");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          updatedFields?: string[];
          timestamp?: string;
        };

        if (data.type === "userData-updated") {
          setLastUpdate(data.timestamp ?? new Date().toISOString());
          // 🔧 FIX: Use invalidate instead of refetch
          void utils.internal.getUserData.invalidate();
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      setTimeout(() => {
        // Reconnect logic here if needed
      }, 5000);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []); // 🔧 FIX: Empty dependency array prevents stale closures

  // Initialize user data on first load
  useEffect(() => {
    if (!userData && !isLoadingData) {
      initializeUserData();
    }
  }, [userData, isLoadingData, initializeUserData]);

  const handleUpdateData = () => {
    const updates: Record<string, string> = {};
    
    Object.entries(fieldInputs).forEach(([fieldName, value]) => {
      if (value.trim()) {
        updates[fieldName] = value.trim();
      }
    });

    if (Object.keys(updates).length === 0) {
      toast.error("Please enter at least one field to update");
      return;
    }

    updateUserData(updates);
  };

  const handleSendToN8n = () => {
    const dataToSend: Record<string, string> = {};
    
    Object.entries(fieldInputs).forEach(([fieldName, value]) => {
      if (value.trim()) {
        dataToSend[fieldName] = value.trim();
      }
    });

    if (Object.keys(dataToSend).length === 0) {
      toast.error("Please enter some data to send to n8n");
      return;
    }

    sendToN8n(dataToSend);
  };

  const getFieldHighlight = (fieldName: string) => {
    return highlightedFields.has(fieldName) 
      ? "bg-green-100 border-green-300 transition-colors duration-300" 
      : "";
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Enhanced n8n + Internal Database Demo
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Live Updates Connected' : 'Disconnected'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Data Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Data Input Section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(fieldInputs).map((fieldName) => (
                <div key={fieldName} className="space-y-2">
                  <Label htmlFor={`${fieldName}-input`}>
                    {fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')}
                  </Label>
                  <Input
                    id={`${fieldName}-input`}
                    value={fieldInputs[fieldName] || ""}
                    onChange={(e) => updateFieldInput(fieldName, e.target.value)}
                    placeholder={`Enter ${fieldName} value`}
                    disabled={isUpdating}
                  />
                </div>
              ))}
              
              <Button 
                onClick={handleUpdateData} 
                disabled={isUpdating}
                className="w-full"
              >
                {isUpdating ? "Updating..." : "Save Data to Internal Database"}
              </Button>
            </CardContent>
          </Card>

          {/* Data Display Section */}
          <Card>
            <CardHeader>
              <CardTitle>Current Database Values</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingData ? (
                <p className="text-muted-foreground">Loading data...</p>
              ) : (
                <>
                  {userData && Object.entries(userData as Record<string, unknown>)
                    .filter(([key]) => !['UID', 'createdAt', 'updatedAt'].includes(key))
                    .map(([fieldName, value]) => (
                      <div key={fieldName} className="space-y-2">
                        <Label>
                          {fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')} (Current Value)
                        </Label>
                        <div className={`p-3 border rounded-md bg-muted ${getFieldHighlight(fieldName)}`}>
                          {String(value) || "(empty)"}
                        </div>
                      </div>
                    ))
                  }
                  
                  {lastUpdate && (
                    <div className="text-sm text-muted-foreground">
                      Last updated via webhook: {new Date(lastUpdate).toLocaleString()}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* n8n Testing Section */}
        <Card>
          <CardHeader>
            <CardTitle>Send to n8n Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This section sends data to n8n for processing. After n8n completes its workflow,
              it will send a webhook back to update the UI with the processed results.
            </p>
            
            <div className="space-y-4">
              <Button 
                onClick={handleSendToN8n}
                className="w-full"
                disabled={isSendingToN8n || isUpdating}
              >
                {isSendingToN8n ? "Sending to n8n..." : "Send Data to n8n"}
              </Button>
              
              <p className="text-sm text-muted-foreground">
                This will send the current input values to n8n. n8n will process them and send a webhook 
                back to refresh the display section.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              System Information
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => void testConnection()}
                  disabled={isTestingConnection}
                >
                  {isTestingConnection ? "Testing..." : "Test DB Connection"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowDebug(!showDebug);
                    void refetchDebug();
                  }}
                >
                  {showDebug ? "Hide Debug" : "Show Debug"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>User ID:</strong> {(userData as { UID?: string })?.UID ?? "Not initialized"}
              </div>
              <div>
                <strong>Connection Status:</strong> {isConnected ? "Connected" : "Disconnected"}
              </div>
              <div>
                <strong>Last Activity:</strong> {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "None"}
              </div>
            </div>
            
            {/* Connection Test Results */}
            {connectionTestResult && (
              <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <h4 className="font-semibold mb-2">Connection Test Results:</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Status:</strong> {connectionTestResult.success ? "✅ Success" : "❌ Failed"}</div>
                  <div><strong>Database URL:</strong> {connectionTestResult.databaseUrl}</div>
                  {connectionTestResult.success && connectionTestResult.connectionInfo && (
                    <>
                      <div><strong>Database:</strong> {(connectionTestResult.connectionInfo as { database_name?: string }).database_name}</div>
                      <div><strong>User:</strong> {(connectionTestResult.connectionInfo as { database_user?: string }).database_user}</div>
                      <div><strong>Server:</strong> {(connectionTestResult.connectionInfo as { server_address?: string }).server_address}:{(connectionTestResult.connectionInfo as { server_port?: string }).server_port}</div>
                    </>
                  )}
                  {connectionTestResult.error && (
                    <div className="text-red-600"><strong>Error:</strong> {connectionTestResult.error}</div>
                  )}
                </div>
              </div>
            )}
            
            {showDebug && debugInfo && (
              <div className="mt-4 p-4 bg-gray-100 rounded-md">
                <h4 className="font-semibold mb-2">Database Debug Information:</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Connection:</strong> {debugInfo.connection}</div>
                  <div><strong>Database URL:</strong> {debugInfo.databaseUrl}</div>
                  <div><strong>Table Status:</strong> {debugInfo.tableExists}</div>
                  <div><strong>Total Records:</strong> {debugInfo.userDataCount}</div>
                  <div><strong>Current User ID:</strong> {debugInfo.currentUserId}</div>
                  {debugInfo.connectionInfo && (
                    <>
                      <div><strong>Database:</strong> {(debugInfo.connectionInfo as { database_name?: string }).database_name}</div>
                      <div><strong>Server:</strong> {(debugInfo.connectionInfo as { server_address?: string }).server_address}:{(debugInfo.connectionInfo as { server_port?: string }).server_port}</div>
                    </>
                  )}
                  {debugInfo.error && (
                    <div className="text-red-600"><strong>Error:</strong> {debugInfo.error}</div>
                  )}
                  {debugInfo.allUserData && debugInfo.allUserData.length > 0 && (
                    <div>
                      <strong>All Data:</strong>
                      <pre className="mt-1 text-xs bg-white p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(debugInfo.allUserData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
