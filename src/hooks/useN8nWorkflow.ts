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
 * - persistentFields: Database fields that persist and can be edited
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
            if (persistentFields.includes(key)) {
              newData[key] = value;
            }
          });
          return newData;
        });
        
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
          
          // Clear input form after successful submission
          setInputData(
            inputFields.reduce((acc, field) => {
              acc[field] = "";
              return acc;
            }, {} as Record<string, string>)
          );
          
          // Refetch workflow history to show new run
          void refetchWorkflowHistory();
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
        if (data.type === "result-updated" && data.id === currentRunIdRef.current) {
          if (data.status) {
            setCurrentRunStatus(data.status);
          }
          void refetchWorkflowHistory();
          
          if (data.status === 'completed' || data.status === 'failed') {
            setCurrentRunId(null);
            currentRunIdRef.current = null;
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
  }, [utils, workflowId, refetchWorkflowHistory]);

  // ==========================================
  // Data Initialization
  // ==========================================

  useEffect(() => {
    if (userData) {
      // Initialize persistent data from userData
      const initialPersistentData: Record<string, string> = {};
      persistentFields.forEach(field => {
        const value = userData[field];
        initialPersistentData[field] = String(value ?? '');
      });
      setPersistentData(initialPersistentData);
      
      // Initialize editable values
      setEditableValues(initialPersistentData);
    }
  }, [userData, persistentFields]);

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
    setSavingFields(prev => new Set(prev).add(fieldName));
    updateUserData({ [fieldName]: editableValues[fieldName] });
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
    workflowHistory,
    runDetails,
    
    // Loading states
    isLoadingData,
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
    refetchWorkflowHistory,
    refetchRunDetails,
  };
}