// ==========================================
// N8N TEMPLATE COMPONENT - ORDER MANAGEMENT
// ==========================================
// 
// 🎯 TEMPLATE EXAMPLE: Order Management with N8N automation
// 
// This template demonstrates the field-driven architecture pattern:
// - INPUT_FIELDS: Form data sent to N8N (no database persistence)
// - PERSISTENT_FIELDS: Store N8N results or user data (require database columns)
// - Real-time updates via SSE connection
// - Complete N8N integration workflow
// ==========================================

"use client";
import { useState, useEffect, useRef } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";
import { AppHeader } from "~/components/layout/AppHeader";

// ==========================================
// 🔧 TEMPLATE CONFIGURATION
// ==========================================

// Input fields: Form data sent to N8N (no database persistence needed)
const INPUT_FIELDS = [
  'orderDescription',   // Order details and requirements
  'urgencyLevel'        // Priority level for processing
];

// Persistent fields: Store N8N results and user data (require database columns)
const PERSISTENT_FIELDS = [
  'aiRecommendation',  // N8N analysis result (read-only)
  'finalDecision'      // User can edit this field and save back
];

export function TemplatePageClient() {
  // ==========================================
  // State Management
  // ==========================================
  const utils = clientApi.useUtils();
  
  // Input form data (gets cleared after sending to N8N)
  const [inputData, setInputData] = useState<Record<string, string>>(
    INPUT_FIELDS.reduce((acc, field) => {
      acc[field] = "";
      return acc;
    }, {} as Record<string, string>)
  );

  // Persistent data (from database, can be displayed and some fields edited)
  const [persistentData, setPersistentData] = useState<Record<string, string>>({});
  const [editableValues, setEditableValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  // SSE and real-time update state
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  // Helper functions
  const updateInputField = (fieldName: string, value: string) => {
    setInputData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const updateEditableField = (fieldName: string, value: string) => {
    setEditableValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // ==========================================
  // tRPC Queries & Mutations
  // ==========================================
  const {
    data: userData,
    refetch: refetchUserData,
    isLoading: isLoadingData,
  } = clientApi.internal.getUserData.useQuery();

  const { mutate: updateUserData } = 
    clientApi.internal.updateUserData.useMutation({
      onSuccess: (data) => {
        toast.success("Field updated successfully!");
        void refetchUserData();
        
        // Update persistent data state with proper type conversion
        const updatedData: Record<string, string> = {};
        Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
          updatedData[key] = String(value ?? '');
        });
        
        setPersistentData((prev: Record<string, string>) => {
          const newData: Record<string, string> = { ...prev };
          Object.entries(updatedData).forEach(([key, value]) => {
            if (PERSISTENT_FIELDS.includes(key)) {
              newData[key] = value;
            }
          });
          return newData;
        });
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
        toast.success("Sent to N8N successfully! Waiting for webhook response...");
        // Clear input fields after successful send
        setInputData(
          INPUT_FIELDS.reduce((acc, field) => {
            acc[field] = "";
            return acc;
          }, {} as Record<string, string>)
        );
      },
      onError: (error) => {
        toast.error(`N8N error: ${error.message}`);
      },
    });

  // ==========================================
  // Real-Time Updates via SSE
  // ==========================================
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
          fetchedValues?: Record<string, string>;
          timestamp?: string;
        };

        if (data.type === "userData-updated") {
          setLastUpdate(data.timestamp ?? new Date().toISOString());
          
          // Highlight updated fields
          if (data.updatedFields) {
            setHighlightedFields(new Set(data.updatedFields));
            
            // Clear highlights after 3 seconds
            setTimeout(() => {
              setHighlightedFields(new Set());
            }, 3000);
          }
          
          // Use invalidate instead of refetch for better performance
          void utils.internal.getUserData.invalidate();
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [utils.internal.getUserData]);

  // Initialize user data and sync persistent data
  useEffect(() => {
    if (!userData && !isLoadingData) {
      initializeUserData();
    }
  }, [userData, isLoadingData, initializeUserData]);

  useEffect(() => {
    if (userData) {
      const persistentValues: Record<string, string> = {};
      PERSISTENT_FIELDS.forEach(field => {
        persistentValues[field] = String((userData as Record<string, unknown>)[field] ?? '');
      });
      setPersistentData(persistentValues);
      setEditableValues(persistentValues);
    }
  }, [userData]);

  // Event handlers
  const handleSendToN8n = () => {
    const dataToSend: Record<string, string> = {};
    
    Object.entries(inputData).forEach(([fieldName, value]) => {
      if (value.trim()) {
        dataToSend[fieldName] = value.trim();
      }
    });

    if (Object.keys(dataToSend).length === 0) {
      toast.error("Please enter some data to send to N8N");
      return;
    }

    sendToN8n(dataToSend);
  };

  const handleSaveField = (fieldName: string) => {
    const value = editableValues[fieldName];
    if (value === undefined) return;

    setSavingFields(prev => new Set(prev).add(fieldName));
    
    updateUserData({ [fieldName]: value });
    
    // Clear saving state after a brief delay
    setTimeout(() => {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }, 1000);
  };

  const getFieldHighlight = (fieldName: string) => {
    return highlightedFields.has(fieldName) 
      ? "bg-green-100 border-green-300 transition-colors duration-300" 
      : "";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Header */}
      <AppHeader 
        currentPage="Template" 
        showBackButton={true}
        backButtonText="← Back to Dashboard"
        backButtonHref="/dashboard"
      />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Template Description */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Order Management Template</CardTitle>
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Live Updates' : 'Disconnected'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This template demonstrates order processing automation with N8N integration. 
              Enter order details, send to N8N for processing, and receive automated recommendations.
            </p>
            <div className="text-sm text-muted-foreground">
              <p><strong>Input Fields:</strong> Order details sent to N8N (no database persistence)</p>
              <p><strong>Persistent Fields:</strong> Store N8N results and user decisions (saved to database)</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Order Input</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter order details to send to N8N for processing
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {INPUT_FIELDS.map((fieldName) => (
                <div key={fieldName} className="space-y-2">
                  <Label htmlFor={`${fieldName}-input`}>
                    {fieldName === 'orderDescription' ? 'Order Description' : 
                     fieldName === 'urgencyLevel' ? 'Urgency Level' :
                     fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')}
                  </Label>
                  <Input
                    id={`${fieldName}-input`}
                    value={inputData[fieldName] ?? ""}
                    onChange={(e) => updateInputField(fieldName, e.target.value)}
                    placeholder={
                      fieldName === 'orderDescription' ? 'Describe the order requirements...' :
                      fieldName === 'urgencyLevel' ? 'e.g., High, Medium, Low' :
                      `Enter ${fieldName}`
                    }
                    disabled={isSendingToN8n}
                  />
                </div>
              ))}
              
              <Button 
                onClick={handleSendToN8n} 
                disabled={isSendingToN8n}
                className="w-full"
              >
                {isSendingToN8n ? "Processing Order..." : "Send to N8N"}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Input fields are cleared after sending to N8N for processing.
              </p>
            </CardContent>
          </Card>

          {/* Persistent Data Section */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
              <p className="text-sm text-muted-foreground">
                N8N processing results and user decisions
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingData ? (
                <p className="text-muted-foreground">Loading order data...</p>
              ) : (
                <>
                  {PERSISTENT_FIELDS.map((fieldName) => {
                    const currentValue = persistentData[fieldName] ?? '';
                    const editableValue = editableValues[fieldName] ?? '';
                    const isEditable = fieldName === 'finalDecision'; // Only finalDecision is editable
                    const isSaving = savingFields.has(fieldName);
                    const hasChanged = editableValue !== currentValue;
                    
                    return (
                      <div key={fieldName} className="space-y-2">
                        <Label>
                          {fieldName === 'aiRecommendation' ? 'AI Recommendation' :
                           fieldName === 'finalDecision' ? 'Final Decision (Editable)' :
                           fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')}
                        </Label>
                        
                        {isEditable ? (
                          <div className="flex space-x-2">
                            <Input
                              value={editableValue}
                              onChange={(e) => updateEditableField(fieldName, e.target.value)}
                              placeholder="Enter your final decision..."
                              className={getFieldHighlight(fieldName)}
                              disabled={isSaving}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveField(fieldName)}
                              disabled={isSaving || !hasChanged}
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <div className={`p-3 border rounded-md bg-muted ${getFieldHighlight(fieldName)}`}>
                            {currentValue || "(Waiting for N8N response...)"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {lastUpdate && (
                    <div className="text-sm text-muted-foreground">
                      Last updated: {new Date(lastUpdate).toLocaleString()}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 