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

// Define what output structure this template expects from N8N
const EXPECTED_RESULTS_SCHEMA = {
  aiRecommendation: 'string',
  confidence: 'number', 
  reasoning: 'string'
} as const;

// Workflow identifier for this template
const WORKFLOW_ID = 'template-processing';

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

  // Results and run history state
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentRunStatus, setCurrentRunStatus] = useState<string>('idle');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  
  // Refs for SSE callback to avoid stale closures
  const currentRunIdRef = useRef<string | null>(null);

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
      onSuccess: (result) => {
        toast.success("Sent to N8N successfully! Watching for progress...");
        
        // Set current run ID for tracking
        if (result.results_id) {
          setCurrentRunId(result.results_id);
          setCurrentRunStatus('processing');
        }
        
        // Clear input fields after successful send
        setInputData(
          INPUT_FIELDS.reduce((acc, field) => {
            acc[field] = "";
            return acc;
          }, {} as Record<string, string>)
        );
        
        // Refresh history to show new run
        void refetchHistory();
      },
      onError: (error) => {
        toast.error(`N8N error: ${error.message}`);
        setCurrentRunStatus('idle');
      },
    });

  // New queries for results management
  const { data: workflowHistory, refetch: refetchHistory } = 
    clientApi.internal.getWorkflowHistory.useQuery({
      workflow_id: WORKFLOW_ID,
      limit: 10
    });

  const { data: selectedRunDetails, isLoading: isLoadingRunDetails } = 
    clientApi.internal.getRunDetails.useQuery(
      { id: selectedRunId! },
      { enabled: !!selectedRunId }
    );

  // Ref for refetchHistory to avoid stale closures
  const refetchHistoryRef = useRef(refetchHistory);

  // Update refs when values change
  useEffect(() => {
    currentRunIdRef.current = currentRunId;
  }, [currentRunId]);

  useEffect(() => {
    refetchHistoryRef.current = refetchHistory;
  }, [refetchHistory]);

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
          id?: string;
          status?: string;
          workflow_id?: string;
          timestamp?: string;
          // Legacy support
          updatedFields?: string[];
          fetchedValues?: Record<string, string>;
        };

        if (data.type === "userData-updated") {
          // Legacy userData update handling
          setLastUpdate(data.timestamp ?? new Date().toISOString());
          
          if (data.updatedFields) {
            setHighlightedFields(new Set(data.updatedFields));
            setTimeout(() => {
              setHighlightedFields(new Set());
            }, 3000);
          }
          
          void utils.internal.getUserData.invalidate();
        } else if (data.type.startsWith("result-")) {
          // New results-based update handling
          setLastUpdate(data.timestamp ?? new Date().toISOString());
          
          if (data.id === currentRunIdRef.current) {
            setCurrentRunStatus(data.status ?? 'unknown');
          }
          
          if (data.type === "result-done" || data.type === "result-failed") {
            // Refresh history when run completes
            void refetchHistoryRef.current();
            
            // If it's our current run, fetch the details
            if (data.id === currentRunIdRef.current) {
              setSelectedRunId(data.id);
              setTimeout(() => setCurrentRunId(null), 1000); // Clear current run after delay
            }
          }
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

    // Reset current run state
    setCurrentRunId(null);
    setCurrentRunStatus('processing');

    sendToN8n({
      data: dataToSend,
      workflow_id: WORKFLOW_ID,
      expected_results_schema: EXPECTED_RESULTS_SCHEMA
    });
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

        {/* Run History Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Order Processing History</span>
              {currentRunId && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    Processing: {currentRunStatus}
                  </span>
                </div>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Track all order processing workflows and view detailed results
            </p>
          </CardHeader>
          <CardContent>
            {workflowHistory && workflowHistory.length > 0 ? (
              <div className="space-y-3">
                {workflowHistory.map((run) => {
                  const isSelected = selectedRunId === run.id;
                  const isCurrentRun = currentRunId === run.id;
                  
                  return (
                    <div key={run.id} className="space-y-2">
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 
                          isCurrentRun ? 'border-orange-500 bg-orange-50' : 
                          'hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedRunId(isSelected ? null : run.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${
                              run.status === 'completed' ? 'bg-green-500' :
                              run.status === 'failed' ? 'bg-red-500' :
                              run.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                              'bg-gray-400'
                            }`} />
                            <div>
                              <div className="font-medium text-sm">
                                {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                                {isCurrentRun && ' (Current)'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(run.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {run.duration_ms && (
                              <div className="text-xs text-muted-foreground">
                                {(run.duration_ms / 1000).toFixed(1)}s
                              </div>
                            )}
                            {run.credits_consumed > 0 && (
                              <div className="text-xs text-orange-600">
                                -{run.credits_consumed} credits
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Run Details */}
                      {isSelected && (
                        <div className="ml-6 p-3 bg-gray-50 rounded-md border">
                          {isLoadingRunDetails ? (
                            <div className="text-sm text-muted-foreground">Loading order details...</div>
                          ) : selectedRunDetails ? (
                            <div className="space-y-3">
                              <div>
                                <h5 className="font-medium text-sm mb-2">Order Input:</h5>
                                <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                                  {JSON.stringify(selectedRunDetails.input_data, null, 2)}
                                </pre>
                              </div>
                              
                              {selectedRunDetails.output_data && (
                                <div>
                                  <h5 className="font-medium text-sm mb-2">Processing Results:</h5>
                                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                                    {JSON.stringify(selectedRunDetails.output_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                              
                              {selectedRunDetails.error_message && (
                                <div>
                                  <h5 className="font-medium text-sm mb-2 text-red-600">Error:</h5>
                                  <div className="text-xs bg-red-50 p-2 rounded border text-red-700">
                                    {selectedRunDetails.error_message}
                                  </div>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Order ID:</span>
                                  <div className="font-mono">{selectedRunDetails.id}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Workflow:</span>
                                  <div>{selectedRunDetails.workflow_id}</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-red-600">Failed to load order details</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-sm">No order processing history yet</div>
                <div className="text-xs mt-1">Submit an order above to create your first processing record</div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 