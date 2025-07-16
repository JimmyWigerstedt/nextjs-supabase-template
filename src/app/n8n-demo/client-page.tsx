// ==========================================
// N8N RESULTS TABLE TEMPLATE COMPONENT - REFACTORED VERSION
// ==========================================
// 
// 🎯 TEMPLATE USAGE: Copy this component for any N8N workflow with run tracking
// 
// ✅ ALWAYS CUSTOMIZE (Your Use Case):
// - INPUT_FIELDS: Form data sent to N8N (no database persistence)
// - EXPECTED_RESULTS_SCHEMA: Expected outputs from N8N workflow
// - WORKFLOW_ID: Unique identifier for your workflow
// - Field labels and validation logic in UI sections
//
// ❌ NEVER MODIFY (Core Template):
// - useN8nWorkflow hook usage and state management
// - Results table operations and run history display
// - Real-time status tracking and update mechanics
//
// 🚀 5-MINUTE ADAPTATION PROCESS:
// 1. cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
// 2. Update INPUT_FIELDS array with your form fields
// 3. Update EXPECTED_RESULTS_SCHEMA array with expected N8N outputs
// 4. Set WORKFLOW_ID to your unique workflow identifier
// 5. Customize field labels and validation in UI sections
//
// 📋 FIELD TYPES EXPLAINED:
// - INPUT_FIELDS: Temporary form data → N8N payload → cleared after send
// - EXPECTED_RESULTS_SCHEMA: Expected N8N outputs → stored in results table
// - WORKFLOW_ID: Unique identifier for workflow tracking and history
// ==========================================

"use client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AppHeader } from "~/components/layout/AppHeader";
import { useN8nWorkflow } from "~/hooks/useN8nWorkflow";

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
  // ✅ HOOK INTEGRATION: All state management handled by custom hook
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
  } = useN8nWorkflow({
    inputFields: INPUT_FIELDS,
    persistentFields: PERSISTENT_FIELDS,
    workflowId: WORKFLOW_ID,
    expectedResultsSchema: EXPECTED_RESULTS_SCHEMA,
  });

  // ==========================================
  // 🎨 CUSTOMIZE UI SECTIONS BELOW
  // ==========================================

  // Helper function to format field names for display
  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      
      <div className="container mx-auto px-4 py-8">
        {/* Connection Status */}
        <div className="mb-4 flex items-center justify-between">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form Section */}
          <Card>
            <CardHeader>
              <CardTitle>Order Processing Request</CardTitle>
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
                {isSendingToN8n ? 'Sending...' : 'Send to N8N'}
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
              <CardTitle>Results & Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingData ? (
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

        {/* Workflow History Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Workflow History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </div>
            ) : (
              <div className="space-y-2">
                {workflowHistory?.map((run) => (
                  <div 
                    key={run.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-2 w-2 rounded-full ${
                        run.status === 'completed' ? 'bg-green-500' : 
                        run.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-sm font-medium">{run.id}</span>
                      <span className="text-sm text-gray-600">{run.status}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(run.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectRun(run.id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRun(run.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Input Data:</h4>
                    <pre className="bg-gray-100 p-2 rounded text-sm">
                      {JSON.stringify(runDetails.input_data, null, 2)}
                    </pre>
                  </div>
                  {runDetails.output_data && (
                    <div>
                      <h4 className="font-medium">Output Data:</h4>
                      <pre className="bg-gray-100 p-2 rounded text-sm">
                        {JSON.stringify(runDetails.output_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Status:</span> {runDetails.status}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {new Date(runDetails.created_at).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Credits Used:</span> {runDetails.credits_consumed}
                    </div>
                    {runDetails.duration_ms && (
                      <div>
                        <span className="font-medium">Duration:</span> {runDetails.duration_ms}ms
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p>No details available for this run.</p>
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
                  <pre className="bg-gray-100 p-2 rounded text-sm">
                    {JSON.stringify(userData, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium">Current State:</h4>
                  <pre className="bg-gray-100 p-2 rounded text-sm">
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