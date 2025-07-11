# Developer Patterns Guide

## 🛠️ **System Mechanics**

### Field Configuration System

The field system drives the entire application architecture through a single configuration array:

```typescript
// PATTERN: Field Definition - Single Source of Truth
const INPUT_FIELDS = [
  'customerEmail',      // Form data → N8N → cleared
  'productSku',         // Form data → N8N → cleared
  'orderQuantity'       // Form data → N8N → cleared
];

const PERSISTENT_FIELDS = [
  'orderStatus',        // Database → display/edit → real-time updates
  'trackingNumber',     // Database → display/edit → real-time updates
  'customerNotes'       // Database → display/edit → real-time updates
];

// MECHANICS: This configuration automatically creates:
// 1. Form inputs for INPUT_FIELDS
// 2. Database operations for PERSISTENT_FIELDS
// 3. N8N payload structure with INPUT_FIELDS
// 4. UI display sections for PERSISTENT_FIELDS
// 5. SSE update targets for real-time highlighting
```

### Component Architecture Patterns

#### Required State Management
```typescript
// PATTERN: Core state variables (never modify)
const [inputData, setInputData] = useState<Record<string, string>>(
  INPUT_FIELDS.reduce((acc, field) => {
    acc[field] = "";
    return acc;
  }, {} as Record<string, string>)
);

const [editableValues, setEditableValues] = useState<Record<string, string>>({});
const [persistentData, setPersistentData] = useState<Record<string, string>>({});
const [isConnected, setIsConnected] = useState(false);
const [lastUpdate, setLastUpdate] = useState<string>("");
const eventSourceRef = useRef<EventSource | null>(null);

// MECHANICS:
// - inputData: Temporary form data for INPUT_FIELDS
// - editableValues: Editing state for PERSISTENT_FIELDS
// - persistentData: Current database values
// - isConnected: SSE connection status
// - lastUpdate: Timestamp of last real-time update
```

#### Required Helper Functions
```typescript
// PATTERN: Standard helper functions (copy exactly)
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

// MECHANICS:
// - updateInputField: Updates form data for INPUT_FIELDS
// - updateEditableField: Updates editing state for PERSISTENT_FIELDS
// - getFieldHighlight: Returns CSS classes for visual feedback
```

### Data Flow Patterns

#### User Input → Database (Direct Save)
```typescript
// PATTERN: Direct database save without N8N
const handleSaveField = (fieldName: string) => {
  const value = editableValues[fieldName];
  setSavingFields(prev => new Set(prev).add(fieldName));
  updateUserData({ [fieldName]: value });
};

// FLOW: User edits field → updateUserData mutation → database UPDATE
```

#### User Input → N8N → Database → UI (Processing Flow)
```typescript
// PATTERN: N8N processing flow
const handleSendToN8n = () => {
  const dataToSend = {};
  Object.entries(inputData).forEach(([fieldName, value]) => {
    if (value.trim()) {
      dataToSend[fieldName] = value.trim();
    }
  });
  sendToN8n(dataToSend);
};

// FLOW: User input → N8N processing → database update → webhook → UI refresh
```

### Dynamic UI Generation

#### Form Generation Pattern
```typescript
// PATTERN: Automatic form generation
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
    />
  </div>
))}

// MECHANICS:
// - Iterates over INPUT_FIELDS configuration
// - Creates controlled inputs with proper state binding
// - Handles undefined values with fallback
// - Applies consistent styling and behavior
```

#### Display Generation Pattern
```typescript
// PATTERN: Automatic value display with editing
{PERSISTENT_FIELDS.map((fieldName) => {
  const currentValue = persistentData[fieldName] || userData?.[fieldName] || '';
  const editValue = editableValues[fieldName] ?? String(currentValue);
  
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
        />
        <Button
          onClick={() => handleSaveField(fieldName)}
          disabled={savingFields.has(fieldName)}
        >
          Save
        </Button>
      </div>
    </div>
  );
})}

// MECHANICS:
// - Shows current database values for PERSISTENT_FIELDS
// - Provides inline editing capability
// - Applies highlighting for real-time updates
// - Handles save operations per field
```

## 🔄 **Integration Patterns**

### tRPC Mutation Patterns
```typescript
// PATTERN: Standard mutation setup
const { mutate: updateUserData } = clientApi.internal.updateUserData.useMutation({
  onSuccess: () => {
    toast.success("Data updated successfully!");
    void utils.internal.getUserData.invalidate();
  },
  onError: (error) => {
    toast.error(`Error: ${error.message}`);
  },
});

const { mutate: sendToN8n, isPending: isSendingToN8n } = 
  clientApi.internal.sendToN8n.useMutation({
    onSuccess: () => {
      toast.success("Sent to N8N successfully!");
      // Clear INPUT_FIELDS after successful send
      setInputData(prev => 
        Object.keys(prev).reduce((acc, key) => {
          acc[key] = "";
          return acc;
        }, {} as Record<string, string>)
      );
    },
    onError: (error) => {
      toast.error(`N8N error: ${error.message}`);
    },
  });

// MECHANICS:
// - updateUserData: Saves PERSISTENT_FIELDS to database
// - sendToN8n: Sends INPUT_FIELDS to N8N for processing
// - Both provide user feedback and error handling
```

### SSE Connection Pattern
```typescript
// PATTERN: Real-time updates (copy exactly)
useEffect(() => {
  const eventSource = new EventSource("/api/stream/user-updates");
  eventSourceRef.current = eventSource;
  
  eventSource.onopen = () => setIsConnected(true);
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "userData-updated") {
        setLastUpdate(data.timestamp ?? new Date().toISOString());
        // Trigger field highlighting
        if (data.updatedFields) {
          setHighlightedFields(new Set(data.updatedFields));
          setTimeout(() => setHighlightedFields(new Set()), 3000);
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

// MECHANICS:
// - Establishes persistent connection for real-time updates
// - Handles field highlighting from webhook notifications
// - Manages connection status and cleanup
```

## 📊 **Database Patterns**

### Field Addition Pattern
```typescript
// PATTERN: Safe field addition
const addField = async (fieldName: string, fieldType = 'VARCHAR') => {
  // Check if field already exists
  const checkResult = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'userData' AND column_name = $2
  `, [schema, fieldName]);
  
  if (checkResult.rows.length === 0) {
    // Add the field
    await client.query(`
      ALTER TABLE "${schema}"."userData" 
      ADD COLUMN "${fieldName}" ${fieldType}
    `);
  }
};

// MECHANICS:
// - Checks field existence before adding
// - Uses parameterized queries for security
// - Supports custom field types
```

### Dynamic SQL Generation
```typescript
// PATTERN: Dynamic UPDATE/INSERT operations
const updateUserData = async (input: Record<string, string>) => {
  const fields = Object.keys(input);
  const values = Object.values(input);
  
  const columnList = fields.map(field => `"${field}"`).join(', ');
  const placeholders = fields.map((_, index) => `$${index + 2}`).join(', ');
  const updateClauses = fields.map(field => 
    `"${field}" = COALESCE(EXCLUDED."${field}", userData."${field}")`
  ).join(', ');
  
  const result = await client.query(
    `INSERT INTO "${schema}"."userData" ("UID", ${columnList}) 
     VALUES ($1, ${placeholders})
     ON CONFLICT ("UID") 
     DO UPDATE SET ${updateClauses}
     RETURNING *`,
    [userId, ...values]
  );
};

// MECHANICS:
// - Builds SQL dynamically from input fields
// - Handles INSERT/UPDATE in single operation
// - Supports any field names without code changes
```

## 🛡️ **Security Patterns**

### Field Validation Pattern
```typescript
// PATTERN: Input validation
const validateFields = (fields: string[]) => {
  return fields.filter(field => 
    /^[a-zA-Z][a-zA-Z0-9_]*$/.test(field) && // Valid identifier
    !['UID', 'created_at', 'updated_at'].includes(field) // Not system fields
  );
};

// MECHANICS:
// - Validates field names against SQL injection
// - Excludes system fields from user updates
// - Ensures field names are valid identifiers
```

### Webhook Security Pattern
```typescript
// PATTERN: Webhook authentication
const verifyWebhook = (request: NextRequest) => {
  const authHeader = request.headers.get("x-webhook-secret");
  const expectedSecret = env.N8N_WEBHOOK_SECRET;
  
  if (authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
};

// MECHANICS:
// - Verifies webhook secret header
// - Prevents unauthorized webhook calls
// - Returns proper HTTP status codes
```

## 🔧 **Customization Patterns**

### Field Formatting Pattern
```typescript
// PATTERN: Custom field display names
const formatFieldName = (fieldName: string) => {
  const customNames: Record<string, string> = {
    'customerEmail': 'Customer Email',
    'productSku': 'Product SKU',
    'orderQuantity': 'Order Quantity',
    'orderStatus': 'Order Status'
  };
  
  return customNames[fieldName] || 
    fieldName.charAt(0).toUpperCase() + 
    fieldName.slice(1).replace(/([A-Z])/g, ' $1');
};

// MECHANICS:
// - Maps field names to display names
// - Provides fallback formatting for unmapped fields
// - Supports camelCase to spaced format conversion
```

### Business Logic Pattern
```typescript
// PATTERN: Custom validation and processing
const handleSendToN8n = () => {
  // Pre-processing validation
  if (inputData.orderQuantity && parseInt(inputData.orderQuantity) > 100) {
    toast.error("Large orders require manager approval");
    return;
  }
  
  // Data transformation
  const processedData = {
    ...inputData,
    orderQuantity: parseInt(inputData.orderQuantity),
    orderTotal: calculateTotal(inputData)
  };
  
  sendToN8n(processedData);
};

// MECHANICS:
// - Validates business rules before sending
// - Transforms data for N8N processing
// - Provides user feedback for validation failures
```

## 🏗️ **Page Creation Pattern**

### Step-by-Step Implementation
```typescript
// STEP 1: Define field configuration
const INPUT_FIELDS = ['field1', 'field2'];
const PERSISTENT_FIELDS = ['result1', 'result2'];

// STEP 2: Add database columns
// npm run add-field result1
// npm run add-field result2

// STEP 3: Copy template structure
// cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx

// STEP 4: Update field arrays in copied component

// STEP 5: Create N8N workflow with standard patterns

// STEP 6: Test integration end-to-end
```

### Validation Checklist
```typescript
// PATTERN: Integration validation
const validateIntegration = () => {
  return {
    formFields: INPUT_FIELDS.length > 0,
    databaseColumns: PERSISTENT_FIELDS.every(field => columnExists(field)),
    n8nPayload: payloadMatchesInputFields(),
    webhookResponse: webhookReturnsUpdatedFields(),
    realTimeUpdates: sseConnectionActive(),
    uiHighlighting: fieldsHighlightOnUpdate()
  };
};

// MECHANICS:
// - Validates each integration point
// - Ensures end-to-end functionality
// - Provides debugging information
```

---

**🎯 Key Takeaway:** These patterns provide the foundation for the template system. The field configuration arrays drive all system behavior, and the component patterns ensure consistent implementation across all pages. 