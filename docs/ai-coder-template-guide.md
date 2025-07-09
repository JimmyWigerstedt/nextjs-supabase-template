# AI Coder Template Guide

## Template Philosophy

This template provides a **reusable pattern** for building data management pages with N8N integration. The key principle is: **Replace field names with your use case, keep all patterns identical**.

## Field Types Distinction

### INPUT_FIELDS
- **Purpose**: Form data sent to N8N for processing
- **Lifecycle**: User input → N8N payload → cleared after send
- **Database**: No database columns needed
- **UI**: Form inputs only

### PERSISTENT_FIELDS  
- **Purpose**: Database columns that store N8N results and user data
- **Lifecycle**: Database → display/edit → real-time updates
- **Database**: Requires database columns (developer responsibility)
- **UI**: Display current values + edit inputs

## Complete Template Component

```typescript
// ==========================================
// TEMPLATE COMPONENT - ADAPTATION GUIDE
// ==========================================
// 
// ✅ ALWAYS CUSTOMIZE (Your Use Case):
// - INPUT_FIELDS: Form data sent to N8N
// - PERSISTENT_FIELDS: Database fields for storage
// - Component name and page title
// - Field labels and validation
//
// ❌ NEVER MODIFY (Core Template):
// - Import statements and state management
// - tRPC mutation patterns
// - SSE connection logic
// - Helper functions and handlers
// ==========================================

"use client";
import { useState, useEffect, useRef } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";

// ==========================================
// 🔧 CUSTOMIZE THIS SECTION FOR YOUR USE CASE
// ==========================================

// ✅ ALWAYS CUSTOMIZE: Replace with your form fields
const INPUT_FIELDS = [
  'customerEmail',     // Example: Replace with your input fields
  'productSku',        // Example: Replace with your input fields
  'orderQuantity'      // Example: Replace with your input fields
];

// ✅ ALWAYS CUSTOMIZE: Replace with your database fields
const PERSISTENT_FIELDS = [
  'orderStatus',       // Example: N8N sets this (developer adds to database)
  'trackingNumber',    // Example: N8N sets this (developer adds to database)
  'customerNotes'      // Example: User can edit this (developer adds to database)
];

// ✅ CUSTOMIZE: Component name
export function YourPageClient() {
  
  // ==========================================
  // ❌ NEVER MODIFY: Core Template State
  // ==========================================
  const utils = clientApi.useUtils();
  
  // Input form data (cleared after sending to N8N)
  const [inputData, setInputData] = useState<Record<string, string>>(
    INPUT_FIELDS.reduce((acc, field) => {
      acc[field] = "";
      return acc;
    }, {} as Record<string, string>)
  );

  // Persistent data from database
  const [persistentData, setPersistentData] = useState<Record<string, string>>({});
  const [editableValues, setEditableValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  // Real-time update state
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  // ==========================================
  // ❌ NEVER MODIFY: Helper Functions
  // ==========================================
  const updateInputField = (fieldName: string, value: string) => {
    setInputData(prev => ({ ...prev, [fieldName]: value }));
  };

  const updateEditableField = (fieldName: string, value: string) => {
    setEditableValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const getFieldHighlight = (fieldName: string) => {
    return highlightedFields.has(fieldName) 
      ? "bg-green-100 border-green-300 transition-colors duration-300" 
      : "";
  };

  // ==========================================
  // ❌ NEVER MODIFY: tRPC Queries & Mutations
  // ==========================================
  const { data: userData, refetch: refetchUserData, isLoading: isLoadingData } = 
    clientApi.internal.getUserData.useQuery();

  const { mutate: updateUserData } = 
    clientApi.internal.updateUserData.useMutation({
      onSuccess: (data) => {
        toast.success("Field updated successfully!");
        void refetchUserData();
        
        // Update persistent data state
        const updatedData: Record<string, string> = {};
        Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
          updatedData[key] = String(value ?? '');
        });
        
        setPersistentData(prev => {
          const newData = { ...prev };
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

  const { mutate: sendToN8n, isPending: isSendingToN8n } = 
    clientApi.internal.sendToN8n.useMutation({
      onSuccess: () => {
        toast.success("Sent to N8N successfully! Waiting for response...");
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
  // ❌ NEVER MODIFY: SSE Real-Time Updates
  // ==========================================
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/user-updates");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setIsConnected(true);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "userData-updated") {
          setLastUpdate(data.timestamp ?? new Date().toISOString());
          
          // Highlight updated fields
          if (data.updatedFields) {
            setHighlightedFields(new Set(data.updatedFields));
            setTimeout(() => setHighlightedFields(new Set()), 3000);
          }
          
          // Update persistent data
          if (data.fetchedValues) {
            const newData: Record<string, string> = {};
            Object.entries(data.fetchedValues).forEach(([key, value]) => {
              newData[key] = String(value ?? '');
            });
            setPersistentData(prev => ({ ...prev, ...newData }));
          }
          
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
  }, []);

  // ==========================================
  // ❌ NEVER MODIFY: Button Handlers
  // ==========================================
  const handleSendToN8n = () => {
    const dataToSend: Record<string, string> = {};
    Object.entries(inputData).forEach(([fieldName, value]) => {
      if (value.trim()) {
        dataToSend[fieldName] = value.trim();
      }
    });
    
    if (Object.keys(dataToSend).length === 0) {
      toast.error("Please enter data to send to N8N");
      return;
    }
    
    sendToN8n(dataToSend);
  };

  const handleSaveField = (fieldName: string) => {
    const value = editableValues[fieldName];
    if (value === undefined) return;
    
    setSavingFields(prev => new Set(prev).add(fieldName));
    updateUserData({ [fieldName]: value });
    
    setTimeout(() => {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }, 1000);
  };

  // ==========================================
  // ✅ CUSTOMIZE: Field Formatting (Optional)
  // ==========================================
  const formatFieldName = (fieldName: string) => {
    // Define custom display names
    const customNames: Record<string, string> = {
      'customerEmail': 'Customer Email',
      'productSku': 'Product SKU',
      'orderQuantity': 'Order Quantity',
      'orderStatus': 'Order Status',
      'trackingNumber': 'Tracking Number',
      'customerNotes': 'Customer Notes'
    };
    
    // Use custom name or format field name
    return customNames[fieldName] || 
      fieldName.charAt(0).toUpperCase() + 
      fieldName.slice(1).replace(/([A-Z])/g, ' $1');
  };

  // ==========================================
  // ✅ CUSTOMIZE: UI Layout and Styling
  // ==========================================
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* ✅ CUSTOMIZE: Page Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your Custom Page Title
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Live Updates Connected' : 'Disconnected'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* ❌ NEVER MODIFY: Input Fields Section */}
        <Card>
          <CardHeader>
            <CardTitle>Data Input (Sent to N8N)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {INPUT_FIELDS.map((fieldName) => (
              <div key={fieldName}>
                <Label htmlFor={`${fieldName}-input`}>
                  {formatFieldName(fieldName)}
                </Label>
                <Input
                  id={`${fieldName}-input`}
                  value={inputData[fieldName] ?? ""}
                  onChange={(e) => updateInputField(fieldName, e.target.value)}
                  disabled={isSendingToN8n}
                  placeholder={`Enter ${formatFieldName(fieldName)}`}
                />
              </div>
            ))}
            
            <Button 
              onClick={handleSendToN8n}
              disabled={isSendingToN8n}
              className="w-full"
            >
              {isSendingToN8n ? "Sending..." : "Send to N8N"}
            </Button>
          </CardContent>
        </Card>

        {/* ❌ NEVER MODIFY: Persistent Fields Section */}
        <Card>
          <CardHeader>
            <CardTitle>Persistent Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {PERSISTENT_FIELDS.map((fieldName) => {
              const currentValue = persistentData[fieldName] || userData?.[fieldName] || '';
              const editValue = editableValues[fieldName] ?? String(currentValue);
              const isSaving = savingFields.has(fieldName);
              
              return (
                <div key={fieldName} className="space-y-2">
                  <Label>{formatFieldName(fieldName)}</Label>
                  
                  {/* Current Value Display */}
                  <div className={`p-2 border rounded ${getFieldHighlight(fieldName)}`}>
                    <span className="text-sm text-muted-foreground">Current: </span>
                    <span>{String(currentValue) || "(empty)"}</span>
                  </div>
                  
                  {/* Edit Input */}
                  <div className="flex space-x-2">
                    <Input
                      value={editValue}
                      onChange={(e) => updateEditableField(fieldName, e.target.value)}
                      placeholder={`Edit ${formatFieldName(fieldName)}`}
                    />
                    <Button
                      onClick={() => handleSaveField(fieldName)}
                      disabled={isSaving}
                      variant="outline"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ✅ CUSTOMIZE: Additional UI sections as needed */}
        {lastUpdate && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Last update: {new Date(lastUpdate).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

## Use Case Adaptation Examples

### E-commerce Order Processing

```typescript
const INPUT_FIELDS = [
  'customerEmail',
  'productSku', 
  'orderQuantity',
  'shippingAddress',
  'paymentMethod'
];

const PERSISTENT_FIELDS = [
  'orderStatus',        // N8N sets: "pending" | "processing" | "shipped"
  'trackingNumber',     // N8N sets: carrier tracking code
  'estimatedDelivery',  // N8N sets: calculated delivery date
  'customerNotes'       // User editable: special instructions
];

const formatFieldName = (fieldName: string) => {
  const labels = {
    'customerEmail': 'Customer Email',
    'productSku': 'Product SKU',
    'orderQuantity': 'Quantity',
    'shippingAddress': 'Shipping Address',
    'paymentMethod': 'Payment Method',
    'orderStatus': 'Order Status',
    'trackingNumber': 'Tracking Number',
    'estimatedDelivery': 'Estimated Delivery',
    'customerNotes': 'Customer Notes'
  };
  return labels[fieldName] || fieldName;
};
```

### Customer Support System

```typescript
const INPUT_FIELDS = [
  'ticketSubject',
  'issueCategory',
  'priorityLevel',
  'customerMessage',
  'attachmentUrl'
];

const PERSISTENT_FIELDS = [
  'assignedAgent',      // N8N sets: auto-assigned based on category
  'ticketStatus',       // N8N sets: "open" | "in-progress" | "resolved"
  'resolutionTime',     // N8N sets: calculated SLA deadline
  'internalNotes'       // User editable: agent notes
];
```

## Customization Points

### Field Validation

```typescript
const validateField = (fieldName: string, value: string): string | null => {
  switch (fieldName) {
    case 'customerEmail':
      return /\S+@\S+\.\S+/.test(value) ? null : 'Invalid email format';
    case 'orderQuantity':
      return !isNaN(Number(value)) && Number(value) > 0 ? null : 'Must be positive number';
    case 'priorityLevel':
      return ['low', 'medium', 'high'].includes(value) ? null : 'Must be low, medium, or high';
    default:
      return null;
  }
};
```

### Field Grouping

```typescript
const fieldGroups = {
  customer: ['customerEmail', 'customerName'],
  order: ['productSku', 'orderQuantity', 'orderStatus'],
  fulfillment: ['trackingNumber', 'shippingAddress', 'estimatedDelivery']
};

// Group fields in UI
Object.entries(fieldGroups).map(([groupName, fields]) => (
  <Card key={groupName}>
    <CardHeader>
      <CardTitle>{groupName.charAt(0).toUpperCase() + groupName.slice(1)} Information</CardTitle>
    </CardHeader>
    <CardContent>
      {fields.map(fieldName => (
        // Your field rendering logic
      ))}
    </CardContent>
  </Card>
));
```

### Conditional Field Display

```typescript
const shouldShowField = (fieldName: string): boolean => {
  // Hide billing address if same as shipping
  if (fieldName === 'billingAddress' && inputData['sameAsShipping'] === 'true') {
    return false;
  }
  
  // Show tracking number only if order is shipped
  if (fieldName === 'trackingNumber' && persistentData['orderStatus'] !== 'shipped') {
    return false;
  }
  
  return true;
};
```

## Field Editing Patterns

### Read-Only Fields
```typescript
const readOnlyFields = ['orderStatus', 'trackingNumber']; // N8N managed fields

const isEditable = (fieldName: string) => {
  return !readOnlyFields.includes(fieldName);
};
```

### Required Fields
```typescript
const requiredFields = ['customerEmail', 'productSku'];

const isRequired = (fieldName: string) => {
  return requiredFields.includes(fieldName);
};
```

This template provides complete patterns for any N8N integration use case. Focus on adapting the field arrays and customization points while keeping the core template structure intact. 