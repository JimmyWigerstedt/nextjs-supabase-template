import { useState, useEffect, useRef } from "react";
import { clientApi } from "~/trpc/react";
import { toast } from "sonner";

/**
 * ==========================================
 * useN8nWorkflow Hook - Centralized N8N Workflow State Management
 * ==========================================
 * 
 * 🎯 PURPOSE: Provides all state management, data fetching, and actions needed for N8N workflow components
 * 
 * ✅ FEATURES:
 * - Complete workflow state management (input, persistent data, run tracking)
 * - Real-time SSE connections for live updates
 * - Comprehensive tRPC integration for all API operations
 * - Automatic form state management and validation
 * - Run history tracking with detailed audit trails
 * - Error handling with user-friendly toast notifications
 * 
 * 📋 CONFIGURATION:
 * - inputFields: Form fields sent to N8N (cleared after submission)
 * - persistentFields: Results table output_data fields that can be displayed and edited
 * - workflowId: Unique identifier for workflow tracking
 * - expectedResultsSchema: Expected output structure from N8N
 * 
 * 🚀 USAGE:
 * const workflow = useN8nWorkflow({
 *   inputFields: ['field1', 'field2'],
 *   persistentFields: ['result1', 'result2'],
 *   workflowId: 'my-workflow',
 *   expectedResultsSchema: { result1: 'string', result2: 'number' }
 * });
 * 
 * ==========================================
 */

interface UseN8nWorkflowProps {
  inputFields: string[];
  persistentFields: string[];
  workflowId: string;
  expectedResultsSchema: Record<string, string>;
}

export function useN8nWorkflow({
  inputFields,
  persistentFields,
  workflowId,
  expectedResultsSchema,
}: UseN8nWorkflowProps) {
  const utils = clientApi.useUtils();

  // ==========================================
  // Core State Management
  // ==========================================
  
  // Input form data (gets cleared after sending to N8N)
  const [inputData, setInputData] = useState<Record<string, string>>(
    inputFields.reduce((acc, field) => {
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
  const currentRunStatusRef = useRef<string>('idle');

  // ==========================================
  // Helper Functions
  // ==========================================

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

  // Get latest results for this workflow
  const {
    data: latestResults,
    refetch: refetchLatestResults,
    isLoading: isLoadingLatestResults,
  } = clientApi.internal.getLatestResults.useQuery({
    workflow_id: workflowId,
  });

  // Update results output data
  const { mutate: updateResultsOutputData } = 
    clientApi.internal.updateResultsOutputData.useMutation({
      onSuccess: (data) => {
        toast.success("Results updated successfully!");
        void refetchLatestResults();
        void refetchWorkflowHistory();
        
        // Update persistent data state with output_data
        if (data.output_data) {
          const outputData = data.output_data as Record<string, unknown>;
          const updatedData: Record<string, string> = {};
          Object.entries(outputData).forEach(([key, value]) => {
            updatedData[key] = String(value ?? '');
          });
          
          setPersistentData((prev: Record<string, string>) => {
            const newData: Record<string, string> = { ...prev };
            Object.entries(updatedData).forEach(([key, value]) => {
              if (persistentFields.includes(key)) {
                newData[key] = value;
              }
            });
            return newData;
          });
        }
        
        // Clear saving state
        setSavingFields(new Set());
      },
      onError: (error) => {
        toast.error(`Update failed: ${error.message}`);
        setSavingFields(new Set());
      }
    });

  const { mutate: sendToN8n, isPending: isSendingToN8n } = 
    clientApi.internal.sendToN8n.useMutation({
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Request sent to N8N successfully!");
          setCurrentRunId(result.results_id);
          setCurrentRunStatus('processing');
          currentRunIdRef.current = result.results_id;
          currentRunStatusRef.current = 'processing';
          
          // Clear input form after successful submission
          setInputData(
            inputFields.reduce((acc, field) => {
              acc[field] = "";
              return acc;
            }, {} as Record<string, string>)
          );
          
          // Refetch workflow history to show new run
          void refetchWorkflowHistory();
          void refetchLatestResults();
        } else {
          toast.error("Failed to send request to N8N");
        }
      },
      onError: (error) => {
        toast.error(`N8N request failed: ${error.message}`);
        setCurrentRunStatus('idle');
      }
    });

  // Workflow History
  const {
    data: workflowHistory,
    refetch: refetchWorkflowHistory,
    isLoading: isLoadingHistory,
  } = clientApi.internal.getWorkflowHistory.useQuery({
    workflow_id: workflowId,
    limit: 20,
    offset: 0,
  });

  // Run Details
  const {
    data: runDetails,
    refetch: refetchRunDetails,
    isLoading: isLoadingRunDetails,
  } = clientApi.internal.getRunDetails.useQuery(
    { id: selectedRunId! },
    { enabled: !!selectedRunId }
  );

  // Delete Run
  const { mutate: deleteRun } = clientApi.internal.deleteRun.useMutation({
    onSuccess: () => {
      toast.success("Run deleted successfully!");
      setSelectedRunId(null);
      void refetchWorkflowHistory();
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    }
  });

  // ==========================================
  // SSE Connection Management
  // ==========================================

  useEffect(() => {
    const eventSource = new EventSource("/api/stream/user-updates");
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      setIsConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          timestamp: string;
          updatedFields?: string[];
          id?: string;
          status?: string;
        };
        
        // Handle userData updates (legacy format)
        if (data.type === "userData-updated") {
          setLastUpdate(data.timestamp);
          void utils.internal.getUserData.invalidate();
          
          // Highlight updated fields
          if (data.updatedFields) {
            setHighlightedFields(new Set(data.updatedFields));
            setTimeout(() => setHighlightedFields(new Set()), 2000);
          }
        }
        
        // Handle results updates (new format)
        if ((data.type === "result-updated" || data.type === "result-done" || data.type === "result-failed") && 
            data.id === currentRunIdRef.current) {
          if (data.status) {
            setCurrentRunStatus(data.status);
            currentRunStatusRef.current = data.status;
          }
          void refetchWorkflowHistory();
          void refetchLatestResults();
          
          if (data.status === 'completed' || data.status === 'failed') {
            setCurrentRunId(null);
            currentRunIdRef.current = null;
            setCurrentRunStatus('idle');
            currentRunStatusRef.current = 'idle';
          }
        }
        
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };
    
    eventSource.onerror = () => {
      setIsConnected(false);
    };
    
    return () => {
      eventSource.close();
    };
  }, [utils, workflowId, refetchWorkflowHistory, refetchLatestResults]);

  // ==========================================
  // Data Initialization
  // ==========================================

  useEffect(() => {
    if (latestResults?.output_data) {
      // Initialize persistent data from latest results output_data
      const outputData = latestResults.output_data as Record<string, unknown>;
      const initialPersistentData: Record<string, string> = {};
      persistentFields.forEach(field => {
        const value = outputData[field];
        initialPersistentData[field] = String(value ?? '');
      });
      setPersistentData(initialPersistentData);
      
      // Initialize editable values
      setEditableValues(initialPersistentData);
    } else {
      // Initialize empty values if no results yet
      const emptyData: Record<string, string> = {};
      persistentFields.forEach(field => {
        emptyData[field] = '';
      });
      setPersistentData(emptyData);
      setEditableValues(emptyData);
    }
  }, [latestResults, persistentFields]);

  // Keep refs in sync with state
  useEffect(() => {
    currentRunIdRef.current = currentRunId;
  }, [currentRunId]);

  useEffect(() => {
    currentRunStatusRef.current = currentRunStatus;
  }, [currentRunStatus]);

  // ==========================================
  // Action Handlers
  // ==========================================

  const handleSendToN8n = () => {
    if (Object.values(inputData).some(value => value.trim() === '')) {
      toast.error("Please fill in all required fields");
      return;
    }

    sendToN8n({
      data: inputData,
      workflow_id: workflowId,
      expected_results_schema: expectedResultsSchema,
    });
  };

  const handleSaveField = (fieldName: string) => {
    if (!latestResults?.id) {
      toast.error("No results to update. Please run the workflow first.");
      return;
    }
    
    setSavingFields(prev => new Set(prev).add(fieldName));
    
    // Get current output_data and update the specific field
    const currentOutputData = latestResults.output_data as Record<string, unknown> || {};
    const updatedOutputData = {
      ...currentOutputData,
      [fieldName]: editableValues[fieldName]
    };
    
    updateResultsOutputData({
      results_id: latestResults.id,
      output_data: updatedOutputData
    });
  };

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
  };

  const handleDeleteRun = (runId: string) => {
    if (confirm("Are you sure you want to delete this run?")) {
      deleteRun({ id: runId });
    }
  };

  // ==========================================
  // Return Hook Interface
  // ==========================================

  return {
    // State
    inputData,
    persistentData,
    editableValues,
    savingFields,
    isConnected,
    lastUpdate,
    highlightedFields,
    showDebug,
    currentRunId,
    currentRunStatus,
    selectedRunId,
    
    // Data
    userData,
    latestResults,
    workflowHistory,
    runDetails,
    
    // Loading states
    isLoadingData,
    isLoadingLatestResults,
    isLoadingHistory,
    isLoadingRunDetails,
    isSendingToN8n,
    
    // Actions
    updateInputField,
    updateEditableField,
    handleSendToN8n,
    handleSaveField,
    handleSelectRun,
    handleDeleteRun,
    setShowDebug,
    
    // Refs
    eventSourceRef,
    currentRunIdRef,
    
    // Utils
    refetchUserData,
    refetchLatestResults,
    refetchWorkflowHistory,
    refetchRunDetails,
  };
}