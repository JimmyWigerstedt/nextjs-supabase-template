"use client";
import { useState, useEffect, useRef } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";

interface UserData {
  UID: string;
  test1: string;
  test2: string;
  createdAt?: string;
  updatedAt?: string;
}

export function N8nDemoClient() {
  const [test1Input, setTest1Input] = useState("");
  const [test2Input, setTest2Input] = useState("");
  const [webhookField, setWebhookField] = useState<"test1" | "test2">("test1");
  const [webhookValue, setWebhookValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  // tRPC queries and mutations
  const {
    data: userData,
    refetch: refetchUserData,
    isLoading: isLoadingData,
  } = clientApi.internal.getUserData.useQuery();

  const { mutate: updateUserData, isPending: isUpdating } = 
    clientApi.internal.updateUserData.useMutation({
      onSuccess: (data) => {
        toast.success("Data updated successfully!");
        void refetchUserData();
        setTest1Input("");
        setTest2Input("");
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

  // Initialize SSE connection for live updates
  useEffect(() => {
    const connectSSE = () => {
      try {
        const eventSource = new EventSource("/api/stream/user-updates");
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log("SSE connection opened");
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("SSE message received:", data);

            switch (data.type) {
              case "connection-established":
                toast.success("Live updates connected!");
                break;
              case "userData-updated":
                setLastUpdate(data.timestamp);
                // Highlight updated fields
                if (data.updatedFields) {
                  setHighlightedFields(new Set(data.updatedFields));
                  // Clear highlights after 3 seconds
                  setTimeout(() => {
                    setHighlightedFields(new Set());
                  }, 3000);
                }
                // Refetch data to get updated values
                void refetchUserData();
                toast.success(`Data updated: ${data.updatedFields?.join(", ")}`);
                break;
              case "heartbeat":
                // Keep connection alive
                break;
            }
          } catch (error) {
            console.error("Failed to parse SSE message:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE error:", error);
          setIsConnected(false);
          eventSource.close();
          
          // Reconnect after 5 seconds
          setTimeout(connectSSE, 5000);
        };
      } catch (error) {
        console.error("Failed to establish SSE connection:", error);
        setIsConnected(false);
      }
    };

    connectSSE();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [refetchUserData]);

  // Initialize user data on first load
  useEffect(() => {
    if (!userData && !isLoadingData) {
      initializeUserData();
    }
  }, [userData, isLoadingData, initializeUserData]);

  const handleUpdateData = () => {
    const updates: { test1?: string; test2?: string } = {};
    if (test1Input.trim()) updates.test1 = test1Input.trim();
    if (test2Input.trim()) updates.test2 = test2Input.trim();

    if (Object.keys(updates).length === 0) {
      toast.error("Please enter at least one field to update");
      return;
    }

    updateUserData(updates);
  };

  const handleWebhookSimulation = async () => {
    if (!webhookValue.trim()) {
      toast.error("Please enter a value for the webhook simulation");
      return;
    }

    try {
      const response = await fetch("/api/webhooks/internal-updated", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
                     "Authorization": `Bearer test-webhook-secret-for-demo`,
        },
                 body: JSON.stringify({
           user_id: userData?.UID,
           updatedFields: [webhookField],
           newValues: {
             [webhookField]: webhookValue,
           },
         }),
      });

      if (response.ok) {
        toast.success("Webhook simulation triggered!");
        setWebhookValue("");
      } else {
        const errorData = await response.json();
        toast.error(`Webhook failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Webhook simulation failed:", error);
      toast.error("Failed to trigger webhook simulation");
    }
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
              <div className="space-y-2">
                <Label htmlFor="test1-input">Test Field 1</Label>
                <Input
                  id="test1-input"
                  value={test1Input}
                  onChange={(e) => setTest1Input(e.target.value)}
                  placeholder="Enter test1 value"
                  disabled={isUpdating}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="test2-input">Test Field 2</Label>
                <Input
                  id="test2-input"
                  value={test2Input}
                  onChange={(e) => setTest2Input(e.target.value)}
                  placeholder="Enter test2 value"
                  disabled={isUpdating}
                />
              </div>
              
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
                  <div className="space-y-2">
                    <Label>Test Field 1 (Current Value)</Label>
                    <div className={`p-3 border rounded-md bg-muted ${getFieldHighlight('test1')}`}>
                      {userData?.test1 || "(empty)"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Test Field 2 (Current Value)</Label>
                    <div className={`p-3 border rounded-md bg-muted ${getFieldHighlight('test2')}`}>
                      {userData?.test2 || "(empty)"}
                    </div>
                  </div>
                  
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

        {/* Webhook Testing Section */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Testing Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This section simulates n8n completing a workflow and sending a webhook to update the UI.
              In production, n8n would trigger this automatically after processing data.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-field">Field to Update</Label>
                <select
                  id="webhook-field"
                  value={webhookField}
                  onChange={(e) => setWebhookField(e.target.value as "test1" | "test2")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="test1">Test Field 1</option>
                  <option value="test2">Test Field 2</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="webhook-value">New Value</Label>
                <Input
                  id="webhook-value"
                  value={webhookValue}
                  onChange={(e) => setWebhookValue(e.target.value)}
                  placeholder="Enter new value"
                />
              </div>
              
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button 
                  onClick={handleWebhookSimulation}
                  className="w-full"
                  disabled={!userData?.UID}
                >
                  Simulate n8n Update
                </Button>
              </div>
            </div>
            
            {!userData?.UID && (
              <p className="text-sm text-yellow-600">
                Initialize user data first to enable webhook simulation
              </p>
            )}
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>User ID:</strong> {userData?.UID || "Not initialized"}
              </div>
              <div>
                <strong>Connection Status:</strong> {isConnected ? "Connected" : "Disconnected"}
              </div>
              <div>
                <strong>Last Activity:</strong> {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "None"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
