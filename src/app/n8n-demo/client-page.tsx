// ==========================================
// N8N TEMPLATE COMPONENT - ADAPTATION GUIDE
// ==========================================
// 
// 🎯 TEMPLATE USAGE: Copy this component for any N8N integration use case
// 
// ✅ ALWAYS CUSTOMIZE (Your Use Case):
// - INPUT_FIELDS: Form data sent to N8N (no database persistence)
// - PERSISTENT_FIELDS: Store N8N results or user data (require database columns)
// - Field labels and validation logic in UI sections
//
// ❌ NEVER MODIFY (Core Template):
// - SSE connection and real-time update logic
// - tRPC mutation patterns and state management
// - Real-time highlighting and update mechanics
//
// 🚀 5-MINUTE ADAPTATION PROCESS:
// 1. cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
// 2. Update INPUT_FIELDS array with your form fields
// 3. Update PERSISTENT_FIELDS array with your database fields  
// 4. Run: node scripts/add-field.js [fieldName] for each PERSISTENT_FIELD
// 5. Customize field labels and validation in UI sections
//
// 📋 FIELD TYPES EXPLAINED:
// - INPUT_FIELDS: Temporary form data → N8N payload → cleared after send
// - PERSISTENT_FIELDS: Database columns → display/edit → real-time updates
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
// 🔧 CUSTOMIZE THIS SECTION FOR YOUR USE CASE
// ==========================================

// ✅ ALWAYS CUSTOMIZE: Replace with your form fields
// These fields create form inputs that send data to N8N
const INPUT_FIELDS = [
  'orderDescription',   // Example: Replace with your input field names
  'urgencyLevel'        // Example: Replace with your input field names
];

// ✅ ALWAYS CUSTOMIZE: Replace with your database fields  
// These fields store N8N results and user data (require database columns)
const PERSISTENT_FIELDS = [
  'aiRecommendation',  // Example: N8N analysis result (read-only)
  'finalDecision'      // Example: User can edit this field and save back
];

// ✅ ALWAYS CUSTOMIZE: Define what output structure this template expects from N8N
const EXPECTED_RESULTS_SCHEMA = {
  aiRecommendation: 'string',
  confidence: 'number', 
  reasoning: 'string'
} as const;

// Workflow identifier for this template
const WORKFLOW_ID = 'order-processing'; // ✅ CUSTOMIZE: Update for your use case

// 💡 TEMPLATE ADAPTATION EXAMPLES:
// E-commerce: INPUT_FIELDS = ['customerEmail', 'productSku', 'orderQuantity']
// Support: INPUT_FIELDS = ['ticketSubject', 'issueCategory', 'priorityLevel']
// Content: INPUT_FIELDS = ['articleTitle', 'contentType', 'publishDate']
// ==========================================

export function N8nDemoClient() {
  // ==========================================
  // ❌ NEVER MODIFY: Core Template State Management
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
  const [showDebug, setShowDebug] = useState(false);
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
  // ❌ NEVER MODIFY: Core Template tRPC Queries & Mutations
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

  const { data: debugInfo, refetch: refetchDebug } = 
    clientApi.internal.debugDatabase.useQuery();

  const { 
    data: connectionTestResult, 
    refetch: testConnection, 
    isLoading: isTestingConnection 
  } = clientApi.internal.testConnection.useQuery(undefined, {
    enabled: false,
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

  // Delete run mutation
  const { mutate: deleteRun, isPending: isDeletingRun } = 
    clientApi.internal.deleteRun.useMutation({
      onSuccess: (data) => {
        toast.success("Run deleted successfully");
        // Close details if we're deleting the selected run
        if (selectedRunId === data.id) {
          setSelectedRunId(null);
        }
        // Refresh history
        void refetchHistory();
      },
      onError: (error) => {
        toast.error(`Failed to delete run: ${error.message}`);
      },
    });

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
  // ❌ NEVER MODIFY: Core Template Real-Time Updates via SSE
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
      <AppHeader currentPage="N8N Demo" />
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          
          {/* ==========================================
              🎨 OPTIONALLY CUSTOMIZE: Page Header & Description
              ========================================== */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>N8N Integration Demo - Dynamic Field Handling</CardTitle>
                {/* Connection Status */}
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-muted-foreground">
                    {isConnected ? 'Live Updates Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                {/* ✅ CUSTOMIZE: Update description for your use case */}
                <p>
                  <strong>Demo Pattern:</strong> This demo shows clear separation between input fields and persistent fields.
                </p>
                <p>
                  <strong>Input Fields:</strong> Form data sent to N8N (no database persistence needed)
                </p>
                <p>
                  <strong>Persistent Fields:</strong> Store N8N results or user-specific data (require database columns)
                </p>
              </div>
            </CardContent>
          </Card>

        {/* Usage Credits Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500" />
              <span>Usage Credits Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">
                  {(() => {
                    const credits = (userData as { usage_credits?: string | number })?.usage_credits;
                    if (credits === null || credits === undefined) return "—";
                    const creditsNum = typeof credits === 'string' ? parseInt(credits, 10) : credits;
                    return isNaN(creditsNum) ? "—" : creditsNum.toLocaleString();
                  })()}
                </div>
                <div className="text-sm text-blue-600 font-medium">Available Credits</div>
                <div className="text-xs text-muted-foreground mt-1">
                  From your subscription plan
                </div>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">
                  {(() => {
                    const credits = (userData as { usage_credits?: string | number })?.usage_credits;
                    if (credits === null || credits === undefined) return "—";
                    const creditsNum = typeof credits === 'string' ? parseInt(credits, 10) : credits;
                    if (isNaN(creditsNum)) return "—";
                    
                    // Simple status based on credit amount
                    if (creditsNum > 500) return "High";
                    if (creditsNum > 100) return "Medium";
                    if (creditsNum > 0) return "Low";
                    return "Empty";
                  })()}
                </div>
                <div className="text-sm text-green-600 font-medium">Credit Status</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Current usage level
                </div>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-700">
                  ∞
                </div>
                <div className="text-sm text-orange-600 font-medium">Monthly Quota</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Resets with billing cycle
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <div className="text-sm text-muted-foreground">
                <strong>How Credits Work:</strong> Each N8N request includes your current credit balance. 
                Your N8N workflow can check available credits and optionally deduct them for usage-based billing.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ==========================================
              🎨 OPTIONALLY CUSTOMIZE: Input Fields UI
              ========================================== */}
          <Card>
            <CardHeader>
              <CardTitle>Input Section</CardTitle> {/* ✅ CUSTOMIZE: Update section title */}
              <p className="text-sm text-muted-foreground">
                Form inputs sent to N8N (no database persistence needed)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {INPUT_FIELDS.map((fieldName) => (
                <div key={fieldName} className="space-y-2">
                  <Label htmlFor={`${fieldName}-input`}>
                    {/* ✅ CUSTOMIZE: Update field label logic for your use case */}
                    {fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')}
                  </Label>
                  <Input
                    id={`${fieldName}-input`}
                    value={inputData[fieldName] ?? ""}
                    onChange={(e) => updateInputField(fieldName, e.target.value)}
                    placeholder={`Enter ${fieldName}`} // ✅ CUSTOMIZE: Update placeholder text
                    disabled={isSendingToN8n}
                    // ✅ CUSTOMIZE: Add field-specific validation, styling, etc.
                  />
                </div>
              ))}
              
              <Button 
                onClick={handleSendToN8n} 
                disabled={isSendingToN8n}
                className="w-full"
              >
                {/* ✅ CUSTOMIZE: Update button text for your use case */}
                {isSendingToN8n ? "Sending to N8N..." : "Send to N8N"}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Input fields are cleared after sending to N8N.
              </p>
            </CardContent>
          </Card>

          {/* Persistent Data Section */}
          <Card>
            <CardHeader>
              <CardTitle>Persistent Data Section</CardTitle>
              <p className="text-sm text-muted-foreground">
                Database fields that store N8N results or user-specific data
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingData ? (
                <p className="text-muted-foreground">Loading persistent data...</p>
              ) : (
                <>
                  {PERSISTENT_FIELDS.map((fieldName) => {
                    const currentValue = persistentData[fieldName] ?? '';
                    const editableValue = editableValues[fieldName] ?? '';
                    const isEditable = fieldName === 'finalDecision'; // Example: only finalDecision is editable
                    const isSaving = savingFields.has(fieldName);
                    const hasChanged = editableValue !== currentValue;
                    
                    return (
                      <div key={fieldName} className="space-y-2">
                        <Label>
                          {fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')}
                          {isEditable && " (Editable)"}
                        </Label>
                        
                        {isEditable ? (
                          <div className="flex space-x-2">
                            <Input
                              value={editableValue}
                              onChange={(e) => updateEditableField(fieldName, e.target.value)}
                              placeholder={`Enter ${fieldName}`}
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
                            {currentValue || "(empty)"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
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

        {/* Run History Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Run History</span>
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
              Track all workflow executions and view detailed results
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
                        className={`p-3 border rounded-lg transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 
                          isCurrentRun ? 'border-orange-500 bg-orange-50' : 
                          'hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 cursor-pointer" onClick={() => setSelectedRunId(isSelected ? null : run.id)}>
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
                          <div className="flex items-center space-x-2">
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
                            {!isCurrentRun && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteRun({ id: run.id });
                                }}
                                disabled={isDeletingRun}
                                title="Delete run"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Run Details */}
                      {isSelected && (
                        <div className="ml-6 p-3 bg-gray-50 rounded-md border">
                          {isLoadingRunDetails ? (
                            <div className="text-sm text-muted-foreground">Loading details...</div>
                          ) : selectedRunDetails ? (
                            <div className="space-y-3">
                              <div>
                                <h5 className="font-medium text-sm mb-2">Input Data:</h5>
                                <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                                  {JSON.stringify(selectedRunDetails.input_data, null, 2)}
                                </pre>
                              </div>
                              
                              {selectedRunDetails.output_data && (
                                <div>
                                  <h5 className="font-medium text-sm mb-2">Output Data:</h5>
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
                                  <span className="text-muted-foreground">Run ID:</span>
                                  <div className="font-mono">{selectedRunDetails.id}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Workflow:</span>
                                  <div>{selectedRunDetails.workflow_id}</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-red-600">Failed to load run details</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-sm">No workflow runs yet</div>
                <div className="text-xs mt-1">Submit the form above to create your first run</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* N8N Integration Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>N8N Integration Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-md">
                <h4 className="font-semibold mb-2">🔧 Setup Required Database Fields</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Only persistent fields need database columns. Run these commands:
                </p>
                <pre className="text-xs bg-white p-2 rounded border">
{`npm run add-field aiRecommendation
npm run add-field finalDecision`}
                </pre>
              </div>
              
              <div className="p-4 bg-green-50 rounded-md">
                <h4 className="font-semibold mb-2">📤 Enhanced N8N Payload (What N8N Receives)</h4>
                <pre className="text-xs bg-white p-2 rounded border">
{`{
  "user_id": "user-uuid-here",
  "id": "results-uuid-for-tracking",
  "workflow_id": "${WORKFLOW_ID}",
  "user_email": "user@example.com",
  "usage_credits": 1000,
  "data": {
    "orderDescription": "user_input_value",
    "urgencyLevel": "user_input_value"
  },
  "expected_results_schema": {
    "aiRecommendation": "string",
    "confidence": "number", 
    "reasoning": "string"
  },
  "action": "process"
}`}
                </pre>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>id:</strong> Track this specific run in the results table<br/>
                  <strong>expected_results_schema:</strong> Output structure N8N should return
                </p>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-md">
                <h4 className="font-semibold mb-2">📥 New N8N Webhook Format (What N8N Should Send Back)</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Send webhook to track progress and completion:
                </p>
                <pre className="text-xs bg-white p-2 rounded border">
{`POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/internal-updated

// Progress Update:
{
  "id": "same-results-uuid-from-request",
  "status": "analyzing"
}

// Completion with Results:
{
  "id": "same-results-uuid-from-request", 
  "status": "completed",
  "credit_cost": 25,
  "output_data": {
    "aiRecommendation": "Process immediately",
    "confidence": 0.85,
    "reasoning": "High priority order with verified customer"
  }
}

// Error:
{
  "id": "same-results-uuid-from-request",
  "status": "failed",
  "output_data": {
    "error": "Processing timeout"
  }
}`}
                </pre>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>credit_cost:</strong> Optional credits to deduct from user balance<br/>
                  <strong>output_data:</strong> Results matching expected_results_schema
                </p>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-md">
                <h4 className="font-semibold mb-2">🔄 Expected N8N Workflow</h4>
                <ol className="text-sm text-muted-foreground space-y-1">
                  <li>1. Receive payload at `/webhook/your-n8n-endpoint`</li>
                  <li>2. Check user&apos;s <strong>usage_credits</strong> for available quota</li>
                  <li>3. Process business logic (calculate costs, determine processing time, etc.)</li>
                  <li>4. Optionally deduct credits by updating <strong>usage_credits</strong> field</li>
                  <li>5. Update database directly with calculated values</li>
                  <li>6. Send webhook back to `/api/webhooks/internal-updated` with updated field names</li>
                  <li>7. Watch persistent fields update automatically with highlighting</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>Usage Credits:</strong> Use the included credits value for quota enforcement, billing calculations, or feature gating. Credits are allocated when invoice payments succeed, not when subscriptions change.
                </p>
              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <strong>User ID:</strong> {(userData as { UID?: string })?.UID ?? "Not initialized"}
              </div>
              <div>
                <strong>Connection Status:</strong> {isConnected ? "Connected" : "Disconnected"}
              </div>
              <div>
                <strong>Last Activity:</strong> {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "None"}
              </div>
              <div>
                <strong>Usage Credits:</strong> {
                  (() => {
                    const credits = (userData as { usage_credits?: string | number })?.usage_credits;
                    if (credits === null || credits === undefined) return "Not set";
                    const creditsNum = typeof credits === 'string' ? parseInt(credits, 10) : credits;
                    return isNaN(creditsNum) ? "Not set" : creditsNum.toLocaleString();
                  })()
                }
              </div>
            </div>
            
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
      </main>
    </div>
  );
}
