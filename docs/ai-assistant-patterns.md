# AI Assistant Development Patterns

## Core System Mechanics

### Field Configuration System

Document how the field system works:

```typescript
// PATTERN: Field Definition
// This array drives the entire system - form generation, database operations, 
// payload structure, and UI updates all derive from these field names
const DEVELOPMENT_FIELDS = [
  'customerName',
  'orderStatus', 
  'priorityLevel'
];

// MECHANICS: This creates:
// 1. Form inputs for each field automatically
// 2. Database columns that can be updated dynamically  
// 3. n8n payload structure with these exact field names
// 4. UI display sections that show current values
// 5. SSE update targets for real-time highlighting
```

### Data Flow Mechanics

Document the complete data lifecycle:

**User Input → Database:**
```typescript
// PATTERN: Direct database save
// User enters data → updateUserData mutation → database UPDATE/INSERT
// No n8n involved, immediate database update

handleUpdateData() → updateUserData({ fieldName: "value" }) → SQL UPDATE
```

**User Input → n8n → Database → UI:**
```typescript
// PATTERN: n8n processing flow
// User enters data → sendToN8n → n8n processes → n8n updates database → 
// n8n sends webhook → UI updates automatically

handleSendToN8n() → n8n workflow → n8n updates database → 
webhook to /api/webhooks/internal-updated → SSE message → UI refresh
```

### Required Component Structure

Document the essential component anatomy:

```typescript
// REQUIRED STATE PATTERN
// These state variables are necessary for the system to function:
const [fieldInputs, setFieldInputs] = useState<Record<string, string>>();  // Form data
const [isConnected, setIsConnected] = useState(false);                     // SSE status  
const [highlightedFields] = useState<Set<string>>();                       // Visual feedback
const eventSourceRef = useRef<EventSource | null>(null);                  // SSE connection

// REQUIRED MUTATIONS PATTERN  
// These tRPC calls handle the standard data operations:
const { data: userData, refetch: refetchUserData } = clientApi.internal.getUserData.useQuery();
const { mutate: updateUserData } = clientApi.internal.updateUserData.useMutation();
const { mutate: sendToN8n } = clientApi.internal.sendToN8n.useMutation();

// REQUIRED SSE PATTERN
// This useEffect establishes real-time updates - identical across all pages:
useEffect(() => {
  const eventSource = new EventSource("/api/stream/user-updates");
  // ... SSE setup logic (copy exactly from n8n-demo)
}, []); // Empty dependency array - SSE connection should only be created once
```

### Form Generation Pattern

Document how dynamic forms work:

```typescript
// PATTERN: Dynamic form generation
// The system generates form inputs automatically from DEVELOPMENT_FIELDS
{Object.keys(fieldInputs).map((fieldName) => (
  <div key={fieldName}>
    <Label>{fieldName}</Label>
    <Input 
      value={fieldInputs[fieldName] ?? ""}
      onChange={(e) => updateFieldInput(fieldName, e.target.value)}
    />
  </div>
))}

// MECHANICS: This pattern:
// 1. Reads field names from the configuration array
// 2. Creates controlled inputs with proper state management
// 3. Handles empty/undefined values safely  
// 4. Updates state through the standard updateFieldInput function
```

### Display Generation Pattern

Document how dynamic displays work:

```typescript
// PATTERN: Dynamic value display
// The system shows current database values with automatic highlighting
{userData && Object.entries(userData)
                  .filter(([key]) => !['UID', 'created_at', 'updated_at'].includes(key))
  .map(([fieldName, value]) => (
    <div key={fieldName}>
      <Label>{fieldName} (Current Value)</Label>
      <div className={getFieldHighlight(fieldName)}>
        {String(value) || "(empty)"}
      </div>
    </div>
  ))
}

// MECHANICS: This pattern:
// 1. Filters out system fields automatically
// 2. Shows all user-defined fields dynamically
// 3. Applies highlighting when fields are updated via webhook
// 4. Handles null/undefined values safely
```

## Critical Integration Points

### Database Field Addition

Document the field addition process:

```bash
# STEP 1: Add database column
npm run add-field newFieldName

# STEP 2: Add to component field list  
const DEVELOPMENT_FIELDS = ['existingField', 'newFieldName'];

# RESULT: System automatically handles:
# - Form input generation
# - Database read/write operations
# - n8n payload inclusion
# - Real-time update capability
```

### n8n Payload Structure

Document the exact payload format n8n receives:

```json
{
  "user_id": "supabase-user-uuid",
  "user_email": "user@example.com", 
  "data": {
    "fieldName1": "user-entered-value1",
    "fieldName2": "user-entered-value2"
  },
  "action": "process"
}

// MECHANICS: 
// - user_id and user_email are injected automatically
// - data object contains exactly the fields from DEVELOPMENT_FIELDS
// - action is always "process" 
// - n8n can access fields via {{ $json.data.fieldName }}
```

### Webhook Response Format

Document what n8n must send back:

```json
{
  "user_id": "same-supabase-user-uuid",
  "updatedFields": ["fieldName1", "fieldName2"]
}

// MECHANICS:
// - user_id must match the original request
// - updatedFields array tells UI which fields to highlight
// - Webhook handler fetches current database values for these fields
// - SSE message sent to trigger UI refresh and highlighting
```

### Real-Time Update Mechanics

Document how the SSE system works:

```
1. User connects → SSE endpoint establishes connection
2. Connection stored in global.activeSSEConnections Map by user ID
3. n8n sends webhook → handler fetches updated field values from database
4. Handler sends SSE message with field names and current values
5. Frontend receives message → highlights specified fields → refreshes display
6. Highlights clear automatically after 3 seconds
```

## New Page Creation Steps

Document the exact process:

### Step 1: Database Setup
```bash
npm run add-field field1
npm run add-field field2
# Add all fields your page needs
```

### Step 2: Component Creation
```typescript
// Copy the n8n-demo component structure exactly
// Change ONLY these elements:
// 1. Component function name
// 2. DEVELOPMENT_FIELDS array contents
// 3. Page title text
// Keep everything else identical
```

### Step 3: Verify Data Flow
```
1. Enter data in form → Click "Save" → Verify database update
2. Enter data in form → Click "Send to n8n" → Verify n8n receives correct payload  
3. n8n processes data → Sends webhook → Verify UI highlights and updates
```

## Troubleshooting Patterns

### SSE Connection Issues
```
Check: Browser console shows "SSE connection opened"
Check: Connection status indicator shows green dot
Check: Network tab shows persistent connection to /api/stream/user-updates
```

### Database Field Issues  
```
Check: Field exists in database schema
Check: Field name in DEVELOPMENT_FIELDS matches database column exactly
Check: Field name contains only letters, numbers, underscores
```

### n8n Integration Issues
```
Check: n8n receives payload with correct field names in data object
Check: n8n workflow updates database with processed values
Check: n8n sends webhook with correct user_id and updatedFields array
``` 