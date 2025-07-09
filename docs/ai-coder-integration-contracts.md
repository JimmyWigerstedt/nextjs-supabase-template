# AI Coder Integration Contracts

## N8N Integration (Black Box)

### Template → N8N Payload
```json
{
  "user_id": "supabase-user-uuid",
  "user_email": "user@example.com",
  "data": {
    "fieldName1": "value1",
    "fieldName2": "value2",
    "fieldName3": "value3"
  },
  "action": "process"
}
```

**Contract Details:**
- `user_id`: Always present, Supabase user UUID
- `user_email`: Always present, user's email address
- `data`: Contains only INPUT_FIELDS with non-empty values
- `action`: Always "process"

### N8N → Template Response
```json
{
  "user_id": "same-user-uuid",
  "updatedFields": ["fieldName1", "fieldName2"]
}
```

**Contract Details:**
- `user_id`: Must match the original payload user_id
- `updatedFields`: Array of PERSISTENT_FIELDS that were updated
- Webhook sent to: `POST /api/webhooks/internal-updated`

## Real-Time Updates (SSE)

### SSE Connection
```javascript
// Connection automatically established
const eventSource = new EventSource("/api/stream/user-updates");
```

### SSE Message Format
```json
{
  "type": "userData-updated",
  "updatedFields": ["fieldName1", "fieldName2"],
  "fetchedValues": {
    "fieldName1": "new-value-1",
    "fieldName2": "new-value-2"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Contract Details:**
- `type`: Always "userData-updated"
- `updatedFields`: Array of field names that changed
- `fetchedValues`: Current database values for updated fields
- `timestamp`: ISO timestamp of the update

### UI Update Behavior
1. Fields in `updatedFields` get highlighted with green background
2. Values in `fetchedValues` update the display
3. Highlights automatically clear after 3 seconds
4. Toast notification shows update confirmation

## Error Handling Patterns

### N8N Send Errors
```typescript
// Handled automatically by template
onError: (error) => {
  toast.error(`N8N error: ${error.message}`);
}
```

### SSE Connection Errors
```typescript
// Connection status automatically tracked
const [isConnected, setIsConnected] = useState(false);

// UI shows connection status
<div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
```

### Field Update Errors
```typescript
// Handled automatically by template
onError: (error) => {
  toast.error(`Error: ${error.message}`);
}
```

## Field Validation Contracts

### Valid Field Names
- Must be valid JavaScript identifiers
- Cannot start with numbers
- Cannot contain spaces or hyphens
- Cannot be SQL reserved words

### Field Value Handling
- All values stored as VARCHAR in database
- Empty values displayed as "(empty)"
- Null/undefined values converted to empty string

## Database Assumptions

### PERSISTENT_FIELDS
- Developer has added all fields to database using `npm run add-field fieldName`
- All fields exist as VARCHAR columns in the internal database
- Fields are automatically created in the correct schema

### System Fields
- `UID`: User identifier (never shown in UI)
- `created_at`: Timestamp (never shown in UI)
- `updated_at`: Timestamp (never shown in UI)

## API Endpoints (Black Box)

### Template Internal APIs
- `POST /api/webhooks/internal-updated`: N8N webhook handler
- `GET /api/stream/user-updates`: SSE endpoint for real-time updates
- tRPC procedures: `internal.getUserData`, `internal.updateUserData`, `internal.sendToN8n`

**Do not modify these endpoints** - they are part of the template infrastructure.

## Use Case Examples

### E-commerce Order Processing
```typescript
// Your payload to N8N
{
  "data": {
    "customerEmail": "john@example.com",
    "productSku": "PROD-123",
    "orderQuantity": "2"
  }
}

// N8N response (after inventory check, payment processing)
{
  "user_id": "uuid",
  "updatedFields": ["orderStatus", "trackingNumber"]
}

// UI updates automatically show:
// - orderStatus: "confirmed"
// - trackingNumber: "1Z999AA1234567890"
```

### Customer Support System
```typescript
// Your payload to N8N
{
  "data": {
    "ticketSubject": "Login Issue",
    "issueCategory": "authentication",
    "priorityLevel": "high"
  }
}

// N8N response (after auto-assignment, SLA calculation)
{
  "user_id": "uuid",
  "updatedFields": ["assignedAgent", "ticketStatus", "estimatedResolution"]
}

// UI updates automatically show:
// - assignedAgent: "John Smith"
// - ticketStatus: "in-progress"
// - estimatedResolution: "2024-01-01T16:00:00Z"
```

## Testing Your Integration

### 1. Test N8N Payload
1. Fill out INPUT_FIELDS in your form
2. Click "Send to N8N"
3. Check N8N workflow logs to verify payload format

### 2. Test N8N Response
1. Configure your N8N workflow to update database fields
2. Send webhook to `/api/webhooks/internal-updated`
3. Verify fields highlight green in UI
4. Verify updated values display correctly

### 3. Test Real-Time Updates
1. SSE connection status should show "Live Updates Connected"
2. Field updates should highlight for 3 seconds
3. Updated values should appear immediately

## Security Considerations

### Webhook Security
- N8N webhook must include proper authentication
- All webhooks are validated before processing
- Invalid webhooks are ignored without error

### User Isolation
- All data is automatically scoped to the authenticated user
- No cross-user data access possible
- User authentication handled by Supabase

## Performance Considerations

### Field Limits
- No hard limit on number of fields
- All fields rendered dynamically
- Performance scales with field count

### Real-Time Updates
- SSE connection per user
- Updates sent only for changed fields
- Connection automatically reconnects on failure

This contract defines the boundaries between your template customization and the underlying N8N/database infrastructure. Focus on your field configuration and UI customization - the integration mechanics are handled automatically. 