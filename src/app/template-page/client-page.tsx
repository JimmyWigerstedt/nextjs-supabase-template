// ==========================================
// N8N TEMPLATE COMPONENT - ORDER MANAGEMENT (REFACTORED)
// ==========================================
// 
// 🎯 TEMPLATE EXAMPLE: Order Management with N8N automation
// 
// This template demonstrates the field-driven architecture pattern using the useN8nWorkflow hook:
// - INPUT_FIELDS: Form data sent to N8N (no database persistence)
// - PERSISTENT_FIELDS: Store N8N results or user data (require database columns)
// - Real-time updates via SSE connection
// - Complete N8N integration workflow
// ==========================================

"use client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AppHeader } from "~/components/layout/AppHeader";
import { useN8nWorkflow } from "~/hooks/useN8nWorkflow";

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
  // Hook Integration - All state management handled by custom hook
  // ==========================================
  const {
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
  } = useN8nWorkflow({
    inputFields: INPUT_FIELDS,
    persistentFields: PERSISTENT_FIELDS,
    workflowId: WORKFLOW_ID,
    expectedResultsSchema: EXPECTED_RESULTS_SCHEMA,
  });

  // ==========================================
  // Helper Functions
  // ==========================================

  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header with Connection Status */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Template Processing</h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {lastUpdate && (
                <span className="text-sm text-gray-500">
                  Last update: {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? 'Hide Debug' : 'Show Debug'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form Section */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {INPUT_FIELDS.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{formatFieldName(field)}</Label>
                  <Input
                    id={field}
                    type="text"
                    value={inputData[field] ?? ''}
                    onChange={(e) => updateInputField(field, e.target.value)}
                    placeholder={`Enter ${formatFieldName(field).toLowerCase()}`}
                  />
                </div>
              ))}
              
              <Button 
                onClick={handleSendToN8n}
                disabled={isSendingToN8n}
                className="w-full"
              >
                {isSendingToN8n ? 'Processing...' : 'Process Template'}
              </Button>
              
              {currentRunId && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Processing run: {currentRunId}
                  </p>
                  <p className="text-sm text-blue-600">
                    Status: {currentRunStatus}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results and Data Section */}
          <Card>
            <CardHeader>
              <CardTitle>Results & Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingData || isLoadingLatestResults ? (
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  {PERSISTENT_FIELDS.map((field) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field}>{formatFieldName(field)}</Label>
                      <div className="flex gap-2">
                        <Input
                          id={field}
                          type="text"
                          value={editableValues[field] ?? ''}
                          onChange={(e) => updateEditableField(field, e.target.value)}
                          className={highlightedFields.has(field) ? 'ring-2 ring-blue-500' : ''}
                          placeholder={field === 'aiRecommendation' ? 'AI analysis will appear here' : 'Enter your decision'}
                        />
                        <Button
                          onClick={() => handleSaveField(field)}
                          disabled={savingFields.has(field)}
                          size="sm"
                        >
                          {savingFields.has(field) ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Processing History Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Processing History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </div>
            ) : workflowHistory && workflowHistory.length > 0 ? (
              <div className="space-y-2">
                {workflowHistory.map((run) => (
                  <div 
                    key={run.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-2 w-2 rounded-full ${
                        run.status === 'completed' ? 'bg-green-500' : 
                        run.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-sm font-medium">{run.id.slice(0, 8)}...</span>
                      <span className="text-sm text-gray-600 capitalize">{run.status}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(run.created_at).toLocaleString()}
                      </span>
                      {run.credits_consumed > 0 && (
                        <span className="text-sm text-blue-600">
                          {run.credits_consumed} credits
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectRun(run.id)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRun(run.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No processing history yet. Submit a request to get started.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Run Details Section */}
        {selectedRunId && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Run Details</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRunDetails ? (
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ) : runDetails ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Input Data:</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="text-sm text-gray-700">
                        {JSON.stringify(runDetails.input_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  {runDetails.output_data && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Output Data:</h4>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <pre className="text-sm text-gray-700">
                          {JSON.stringify(runDetails.output_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {runDetails.error_message && (
                    <div>
                      <h4 className="font-medium text-red-900 mb-2">Error Message:</h4>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-700">{runDetails.error_message}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded">
                      <span className="font-medium">Status:</span> 
                      <span className="ml-2 capitalize">{runDetails.status}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <span className="font-medium">Created:</span> 
                      <span className="ml-2">{new Date(runDetails.created_at).toLocaleString()}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <span className="font-medium">Credits Used:</span> 
                      <span className="ml-2">{runDetails.credits_consumed}</span>
                    </div>
                    {runDetails.duration_ms && (
                      <div className="bg-gray-50 p-3 rounded">
                        <span className="font-medium">Duration:</span> 
                        <span className="ml-2">{runDetails.duration_ms}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No details available for this run.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Debug Information */}
        {showDebug && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">User Data:</h4>
                  <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                    {JSON.stringify(userData, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium">Latest Results:</h4>
                  <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                    {JSON.stringify(latestResults, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium">Current State:</h4>
                  <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                    {JSON.stringify({
                      inputData,
                      persistentData,
                      editableValues,
                      currentRunId,
                      currentRunStatus,
                      selectedRunId,
                      isConnected,
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}