# UI Component Patterns

## Core Functional Patterns

### Dynamic Form Generation
```typescript
// PATTERN: Automatic form generation from field configuration
{Object.keys(fieldInputs).map((fieldName) => (
  <div key={fieldName}>
    <Label htmlFor={`${fieldName}-input`}>{fieldName}</Label>
    <Input
      id={`${fieldName}-input`}
      value={fieldInputs[fieldName] ?? ""}
      onChange={(e) => updateFieldInput(fieldName, e.target.value)}
      disabled={isUpdating}
    />
  </div>
))}

// MECHANICS:
// - Iterates over DEVELOPMENT_FIELDS automatically
// - Creates controlled inputs with proper state binding
// - Handles undefined values with fallback to empty string
// - Maintains form state through updateFieldInput function
```

### Dynamic Value Display  
```typescript
// PATTERN: Automatic current value display with highlighting
{userData && Object.entries(userData)
  .filter(([key]) => !['UID', 'createdAt', 'updatedAt'].includes(key))
  .map(([fieldName, value]) => (
    <div key={fieldName}>
      <Label>{fieldName} (Current Value)</Label>
      <div className={getFieldHighlight(fieldName)}>
        {String(value) || "(empty)"}
      </div>
    </div>
  ))
}

// MECHANICS:
// - Filters out system fields automatically  
// - Shows all user-defined fields dynamically
// - Applies highlighting when getFieldHighlight returns CSS classes
// - Converts all values to strings safely
```

### Required State Management
```typescript
// PATTERN: Essential state variables for system function
const [fieldInputs, setFieldInputs] = useState<Record<string, string>>(
  DEVELOPMENT_FIELDS.reduce((acc, field) => {
    acc[field] = "";
    return acc;
  }, {} as Record<string, string>)
);
const [highlightedFields] = useState<Set<string>>(new Set());
const [isConnected, setIsConnected] = useState(false);

// MECHANICS:
// - fieldInputs: Stores form data for all configured fields
// - highlightedFields: Tracks which fields to highlight after updates
// - isConnected: Tracks SSE connection status for user feedback
```

### Required Helper Functions
```typescript
// PATTERN: Standard helper functions (copy exactly)
const updateFieldInput = (fieldName: string, value: string) => {
  setFieldInputs(prev => ({ ...prev, [fieldName]: value }));
};

const getFieldHighlight = (fieldName: string) => {
  return highlightedFields.has(fieldName) 
    ? "bg-green-100 border-green-300 transition-colors duration-300" 
    : "";
};

// MECHANICS:
// - updateFieldInput: Updates individual field values in state
// - getFieldHighlight: Returns CSS classes for visual feedback
// - Both functions work with any field names dynamically
```

## Integration Patterns

### tRPC Mutation Handling
```typescript
// PATTERN: Standard mutation setup for data operations
const { mutate: updateUserData, isPending: isUpdating } = 
  clientApi.internal.updateUserData.useMutation({
    onSuccess: () => {
      toast.success("Data updated successfully!");
      void refetchUserData();
      // Clear form inputs
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

// MECHANICS:
// - Handles success with data refresh and form clearing
// - Provides error feedback to user
// - Uses isPending for loading states
```

### SSE Connection Pattern
```typescript
// PATTERN: Real-time update connection (copy exactly)
useEffect(() => {
  const eventSource = new EventSource("/api/stream/user-updates");
  eventSourceRef.current = eventSource;
  
  eventSource.onopen = () => {
    setIsConnected(true);
  };
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as {
        type: string;
        updatedFields?: string[];
        timestamp?: string;
      };

      if (data.type === "userData-updated") {
        setLastUpdate(data.timestamp ?? new Date().toISOString());
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
}, [utils.internal.getUserData]);

// MECHANICS:
// - Establishes persistent connection for real-time updates
// - Parses webhook notifications and updates UI state
// - Handles connection status for user feedback
// - Manages cleanup on component unmount
```

## Customization Functions

### Field Name Formatting
```typescript
// PATTERN: Custom field display names
const formatFieldName = (fieldName: string): string => {
  // Define custom display names for specific fields
  const customNames: Record<string, string> = {
    'customerEmail': 'Email Address',
    'orderTotal': 'Total Amount',
    'billingAddr': 'Billing Address',
    'phoneNum': 'Phone Number'
  };
  
  // Use custom name if available, otherwise format the field name
  return customNames[fieldName] || 
    fieldName.charAt(0).toUpperCase() + 
    fieldName.slice(1).replace(/([A-Z])/g, ' $1');
};

// USAGE: Replace hardcoded field names in labels
<Label htmlFor={`${fieldName}-input`}>
  {formatFieldName(fieldName)}
</Label>
```

### Value Formatting
```typescript
// PATTERN: Custom value display formatting
const formatFieldValue = (fieldName: string, value: unknown): string => {
  const stringValue = String(value ?? '');
  
  switch (fieldName) {
    case 'orderTotal':
      return stringValue ? `$${stringValue}` : '(no amount)';
    case 'customerEmail':
      return stringValue.toLowerCase();
    case 'phoneNum':
      return stringValue.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    case 'createdAt':
    case 'updatedAt':
      return stringValue ? new Date(stringValue).toLocaleString() : '(not set)';
    default:
      return stringValue || "(empty)";
  }
};

// USAGE: Replace direct value display
<div className={getFieldHighlight(fieldName)}>
  {formatFieldValue(fieldName, value)}
</div>
```

### Field Validation
```typescript
// PATTERN: Input validation before submission
const validateInput = (updates: Record<string, string>): string | null => {
  for (const [fieldName, value] of Object.entries(updates)) {
    switch (fieldName) {
      case 'customerEmail':
        if (!/\S+@\S+\.\S+/.test(value)) {
          return 'Invalid email format';
        }
        break;
      case 'orderTotal':
        if (isNaN(Number(value))) {
          return 'Order total must be a number';
        }
        break;
      case 'phoneNum':
        if (!/^\d{10}$/.test(value.replace(/\D/g, ''))) {
          return 'Phone number must be 10 digits';
        }
        break;
      case 'zipCode':
        if (!/^\d{5}(-\d{4})?$/.test(value)) {
          return 'Invalid ZIP code format';
        }
        break;
    }
  }
  return null;
};

// USAGE: Add to form submission handler
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

  const error = validateInput(updates);
  if (error) {
    toast.error(error);
    return;
  }

  updateUserData(updates);
};
```

## Layout Patterns

### Card-Based Layout
```typescript
// PATTERN: Organized card sections for different functionality
<div className="w-full max-w-4xl space-y-6">
  {/* Input Section */}
  <Card>
    <CardHeader>
      <CardTitle>Data Input Section</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Dynamic form inputs */}
      {Object.keys(fieldInputs).map((fieldName) => (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={`${fieldName}-input`}>
            {formatFieldName(fieldName)}
          </Label>
          <Input
            id={`${fieldName}-input`}
            value={fieldInputs[fieldName] ?? ""}
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
        {isUpdating ? "Updating..." : "Save Data to Database"}
      </Button>
    </CardContent>
  </Card>

  {/* Display Section */}
  <Card>
    <CardHeader>
      <CardTitle>Current Values</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {isLoadingData ? (
        <p className="text-muted-foreground">Loading data...</p>
      ) : (
        userData && Object.entries(userData as Record<string, unknown>)
          .filter(([key]) => !['UID', 'createdAt', 'updatedAt'].includes(key))
          .map(([fieldName, value]) => (
            <div key={fieldName} className="space-y-2">
              <Label>
                {formatFieldName(fieldName)} (Current Value)
              </Label>
              <div className={`p-3 border rounded-md bg-muted ${getFieldHighlight(fieldName)}`}>
                {formatFieldValue(fieldName, value)}
              </div>
            </div>
          ))
      )}
    </CardContent>
  </Card>
</div>
```

### Grid Layout
```typescript
// PATTERN: Two-column grid for input/display
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Left Column - Input */}
  <Card>
    <CardHeader>
      <CardTitle>Input Form</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Form inputs */}
    </CardContent>
  </Card>

  {/* Right Column - Display */}
  <Card>
    <CardHeader>
      <CardTitle>Current Values</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Value display */}
    </CardContent>
  </Card>
</div>
```

### Grouped Fields Layout
```typescript
// PATTERN: Organize fields by logical groups
const fieldGroups = {
  personal: ['firstName', 'lastName', 'email'],
  address: ['street', 'city', 'state', 'zipCode'],
  order: ['productSku', 'quantity', 'orderTotal']
};

// Render grouped sections
{Object.entries(fieldGroups).map(([groupName, fields]) => (
  <Card key={groupName}>
    <CardHeader>
      <CardTitle>{groupName.charAt(0).toUpperCase() + groupName.slice(1)} Information</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {fields
        .filter(fieldName => fieldInputs.hasOwnProperty(fieldName))
        .map(fieldName => (
          <div key={fieldName} className="space-y-2">
            <Label>{formatFieldName(fieldName)}</Label>
            <Input
              value={fieldInputs[fieldName] ?? ""}
              onChange={(e) => updateFieldInput(fieldName, e.target.value)}
            />
          </div>
        ))
      }
    </CardContent>
  </Card>
))}
```

## Essential Structure

### Minimal Working Component
```typescript
export function NewPageClient() {
  // 1. Field configuration
  const DEVELOPMENT_FIELDS = ['field1', 'field2'];
  
  // 2. Required state (copy exactly)
  const [fieldInputs, setFieldInputs] = useState<Record<string, string>>(
    DEVELOPMENT_FIELDS.reduce((acc, field) => {
      acc[field] = "";
      return acc;
    }, {} as Record<string, string>)
  );
  const [highlightedFields] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // 3. Required mutations (copy exactly)  
  const utils = clientApi.useUtils();
  const { data: userData, refetch, isLoading: isLoadingData } = 
    clientApi.internal.getUserData.useQuery();
  const { mutate: updateUserData, isPending: isUpdating } = 
    clientApi.internal.updateUserData.useMutation({
      onSuccess: () => {
        toast.success("Data updated successfully!");
        void refetch();
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
  const { mutate: sendToN8n, isPending: isSendingToN8n } = 
    clientApi.internal.sendToN8n.useMutation({
      onSuccess: () => {
        toast.success("Sent to n8n successfully!");
        setFieldInputs(prev => 
          Object.keys(prev).reduce((acc, key) => {
            acc[key] = "";
            return acc;
          }, {} as Record<string, string>)
        );
      },
      onError: (error) => {
        toast.error(`n8n error: ${error.message}`);
      },
    });
  
  // 4. Required SSE setup (copy exactly)
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/user-updates");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          updatedFields?: string[];
          timestamp?: string;
        };

        if (data.type === "userData-updated") {
          setLastUpdate(data.timestamp ?? new Date().toISOString());
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
  
  // 5. Required helpers (copy exactly)
  const updateFieldInput = (fieldName: string, value: string) => {
    setFieldInputs(prev => ({ ...prev, [fieldName]: value }));
  };
  
  const getFieldHighlight = (fieldName: string) => {
    return highlightedFields.has(fieldName) 
      ? "bg-green-100 border-green-300 transition-colors duration-300" 
      : "";
  };
  
  // 6. Required handlers (copy exactly)
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
  
  // 7. UI rendering (customize this part)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Your custom UI structure here */}
      </div>
    </div>
  );
}
```

## Critical Rules

### Never Modify These Patterns
- SSE connection setup and event handling
- tRPC mutation structure and handlers
- State management for fieldInputs and highlightedFields  
- Helper function implementations
- Form submission logic

### Safe to Customize
- Field display names and formatting
- Value display formatting
- UI layout and structure
- Validation rules
- Error messages
- Page titles and descriptions

### Field Name Requirements
- Must be valid JavaScript identifiers
- Must match database column names exactly
- Should not conflict with system fields: 'UID', 'createdAt', 'updatedAt'
- Recommended: camelCase or snake_case naming

### CSS Classes for Highlighting
```css
/* Standard highlight classes for real-time updates */
.highlight-success {
  @apply bg-green-100 border-green-300 transition-colors duration-300;
}

.highlight-warning {
  @apply bg-yellow-100 border-yellow-300 transition-colors duration-300;
}

.highlight-error {
  @apply bg-red-100 border-red-300 transition-colors duration-300;
}
``` 