# Data Lifecycle Examples

## Complete Field Flow Example

### Step 1: Field Addition
```bash
npm run add-field customerStatus
# Creates: ALTER TABLE "${NC_SCHEMA}"."userData" ADD COLUMN "customerStatus" VARCHAR;
```

### Step 2: Component Configuration
```typescript
const DEVELOPMENT_FIELDS = ['customerStatus'];
// Result: Form input and display automatically generated
```

### Step 3: User Input → Database
User enters "active" → clicks "Save Data"
```typescript
Frontend: updateUserData({ customerStatus: "active" });
Backend: SQL UPDATE userData SET customerStatus = 'active' WHERE UID = 'user-id';
```

### Step 4: User Input → n8n
User enters "active" → clicks "Send to n8n"
```json
Payload to n8n:
{
  "user_id": "user-id",
  "user_email": "user@email.com",
  "data": { "customerStatus": "active" },
  "action": "process"
}
```

### Step 5: n8n Processing
```
n8n workflow:
1. Receives payload via webhook
2. Accesses {{ $json.data.customerStatus }} = "active"  
3. Processes data (e.g., "active" → "ACTIVE_CUSTOMER")
4. Updates database directly: UPDATE userData SET customerStatus = 'ACTIVE_CUSTOMER'
```

### Step 6: n8n → Frontend Notification
```json
n8n sends webhook to /api/webhooks/internal-updated:
{
  "user_id": "user-id",
  "updatedFields": ["customerStatus"]
}
```

### Step 7: Real-Time UI Update
```
Webhook handler:
1. Fetches current database value → "ACTIVE_CUSTOMER"
2. Sends SSE message with fetched value
3. UI highlights customerStatus field
4. Display shows "ACTIVE_CUSTOMER"
5. Highlight clears after 3 seconds
```

## Multi-Field Example

### Input Data
```typescript
fieldInputs = {
  customerName: "John Doe",
  orderStatus: "pending"
}
```

### n8n Payload
```json
{
  "data": {
    "customerName": "John Doe", 
    "orderStatus": "pending"
  }
}
```

### Webhook Response
```json
{
  "user_id": "user-id",
  "updatedFields": ["customerName", "orderStatus"]
}
```

### UI Result
- Both fields highlight simultaneously
- Display shows processed values from database
- Single toast notification with both updates

## System Validation Examples

### Valid Field Names
```
✅ customerName    (camelCase)
✅ order_status    (snake_case)  
✅ shipment123     (alphanumeric)
✅ billingAddr     (abbreviated)
```

### Invalid Field Names
```
❌ customer-name   (hyphens not allowed)
❌ order status    (spaces not allowed)
❌ 123order        (cannot start with number)
❌ class           (SQL reserved word)
```

### Error Handling

**Missing user in database:**
```json
Webhook: {"user_id": "nonexistent", "updatedFields": ["field1"]}
Result: Empty fetchedValues, no UI highlight, no error
```

**Invalid field in webhook:**
```json
Webhook: {"updatedFields": ["validField", "invalidField"]}
Result: "validField" processed normally, "invalidField" ignored
```

**SSE connection down:**
```
Webhook received → Update stored in pendingUpdates → 
User reconnects → Pending update sent immediately
```

## Field Processing Patterns

### Database Field Types
All user fields are stored as VARCHAR in the internal database:
```sql
ALTER TABLE "${NC_SCHEMA}"."userData" ADD COLUMN "fieldName" VARCHAR;
```

### Type Handling
```typescript
// All values converted to strings for consistency:
const value = String(userData[fieldName] ?? '');

// Empty/null handling:
display = value || "(empty)";
```

### System Field Exclusion
```typescript
// These fields are never shown in UI or processed as user fields:
const systemFields = ['UID', 'created_at', 'updated_at'];
const userFields = Object.keys(userData).filter(key => !systemFields.includes(key));
```

## Real-World Integration Examples

### E-commerce Order Processing
```typescript
// Fields configuration
const DEVELOPMENT_FIELDS = [
  'customerEmail',
  'productSku',
  'orderQuantity',
  'shippingAddress'
];

// User input
handleSendToN8n() sends:
{
  "data": {
    "customerEmail": "john@example.com",
    "productSku": "PROD-123",
    "orderQuantity": "2",
    "shippingAddress": "123 Main St"
  }
}

// n8n workflow processes:
1. Validates customer email
2. Checks product inventory
3. Calculates shipping
4. Updates order status
5. Sends confirmation email

// n8n sends back:
{
  "updatedFields": ["orderQuantity", "shippingAddress"]
}
```

### Customer Support Workflow
```typescript
// Fields configuration
const DEVELOPMENT_FIELDS = [
  'ticketSubject',
  'issueCategory',
  'priorityLevel',
  'customerMessage'
];

// n8n workflow:
1. Analyzes customer message sentiment
2. Auto-categorizes issue type
3. Sets priority based on keywords
4. Routes to appropriate team
5. Generates auto-response

// Database updates:
ticketSubject: "Login Issues" → "URGENT: Login Issues"
issueCategory: "general" → "technical"
priorityLevel: "medium" → "high"
```

### Marketing Automation
```typescript
// Fields configuration  
const DEVELOPMENT_FIELDS = [
  'leadSource',
  'contactPreferences',
  'industryType',
  'companySize'
];

// n8n workflow:
1. Scores lead based on company size
2. Segments by industry type
3. Personalizes outreach cadence
4. Updates CRM records
5. Triggers email sequences

// Real-time updates show:
leadSource: "website" → "qualified-lead"
contactPreferences: "email" → "email,phone"
```

## Advanced Pattern Examples

### Conditional Field Processing
```typescript
// n8n workflow logic:
if (customerStatus === "vip") {
  priorityLevel = "high";
  responseTime = "immediate";
} else if (orderTotal > 1000) {
  priorityLevel = "medium";
  responseTime = "4-hours";
}

// Webhook includes all affected fields:
{
  "updatedFields": ["customerStatus", "priorityLevel", "responseTime"]
}
```

### Cascading Updates
```typescript
// Single field change triggers multiple updates:
User changes: shippingMethod = "express"

// n8n calculates:
shippingCost = "25.00"
deliveryDate = "2024-01-15"
trackingEnabled = "true"

// All fields update in UI simultaneously:
{
  "updatedFields": ["shippingMethod", "shippingCost", "deliveryDate", "trackingEnabled"]
}
```

### Validation and Error Handling
```typescript
// Invalid data handling in n8n:
if (!isValidEmail(customerEmail)) {
  errorMessage = "Invalid email format";
  customerEmail = ""; // Clear invalid value
}

// Error fields also trigger UI updates:
{
  "updatedFields": ["customerEmail", "errorMessage"]
}
```

## Performance Considerations

### Batch Updates
```typescript
// Efficient: Single webhook with multiple fields
{
  "updatedFields": ["field1", "field2", "field3"]
}

// Inefficient: Multiple separate webhooks  
// Avoid sending individual webhooks for each field
```

### Large Field Sets
```typescript
// For pages with many fields, consider grouping:
const CONTACT_FIELDS = ['name', 'email', 'phone'];
const ADDRESS_FIELDS = ['street', 'city', 'zip'];
const ORDER_FIELDS = ['product', 'quantity', 'total'];

// Process related fields together in n8n workflow
```

### Database Optimization
```sql
-- Index frequently queried fields
CREATE INDEX idx_userData_status ON "userData"(status);
CREATE INDEX idx_userData_priority ON "userData"(priority);

-- Avoid indexing rarely used fields to save space
``` 