# N8N Integration Template Guide

## 🎯 **Template Philosophy**

This template provides **standardized patterns** for integrating N8N workflows with your custom data management applications. The patterns ensure consistent communication, security, and real-time updates across any field configuration.

**Key Principle:** Your N8N workflows receive standardized payloads regardless of your field names.

## 📋 **Template Workflow Pattern**

### Standard Payload Structure
Your N8N workflows always receive this exact structure:

```json
{
  "user_id": "supabase-user-uuid",
  "user_email": "user@example.com",
  "data": {
    "yourField1": "value1",
    "yourField2": "value2",
    "yourField3": "value3"
  },
  "action": "process"
}
```

### Standard Response Structure
Your N8N workflows must send back this exact structure:

```json
{
  "user_id": "same-user-uuid",
  "updatedFields": ["yourField1", "yourField2"]
}
```

## 🛠️ **Environment Setup**

Add these environment variables to your `.env` file:

```bash
# N8N Integration
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-secure-webhook-secret-at-least-32-chars"
N8N_TIMEOUT=30000
```

## 🔧 **Template Usage Examples**

### E-commerce Order Processing
```typescript
// Step 1: Define your fields
const DEVELOPMENT_FIELDS = [
  'customerEmail',
  'productSku',
  'orderQuantity',
  'shippingAddress',
  'paymentStatus'
];

// Step 2: N8N workflow receives:
{
  "user_id": "uuid-123",
  "user_email": "customer@example.com",
  "data": {
    "customerEmail": "customer@example.com",
    "productSku": "PROD-123",
    "orderQuantity": "2",
    "shippingAddress": "123 Main St",
    "paymentStatus": "pending"
  },
  "action": "process"
}
```

**N8N Workflow Logic:**
```javascript
// Access your fields
const customerEmail = $json.data.customerEmail;
const productSku = $json.data.productSku;
const orderQuantity = $json.data.orderQuantity;

// Process your business logic
if (orderQuantity > 5) {
  // Apply bulk discount
  // Update inventory
  // Send to fulfillment
}

// Update database with processed values
// Send webhook response
```

### Customer Support System
```typescript
// Step 1: Define your fields
const DEVELOPMENT_FIELDS = [
  'ticketSubject',
  'issueCategory',
  'priorityLevel',
  'customerMessage',
  'assignedAgent'
];

// Step 2: N8N workflow receives:
{
  "user_id": "uuid-456",
  "user_email": "support@company.com",
  "data": {
    "ticketSubject": "Login Issues",
    "issueCategory": "technical",
    "priorityLevel": "high",
    "customerMessage": "Cannot access account",
    "assignedAgent": "support-team"
  },
  "action": "process"
}
```

**N8N Workflow Logic:**
```javascript
// Access your fields
const ticketSubject = $json.data.ticketSubject;
const issueCategory = $json.data.issueCategory;
const priorityLevel = $json.data.priorityLevel;

// Process your business logic
if (priorityLevel === "high") {
  // Send urgent alert
  // Escalate to senior support
  // Set SLA timer
}

// Update database with processed values
// Send webhook response
```

### Content Management
```typescript
// Step 1: Define your fields
const DEVELOPMENT_FIELDS = [
  'contentTitle',
  'contentType',
  'publishDate',
  'authorName',
  'contentStatus'
];

// Step 2: N8N workflow receives:
{
  "user_id": "uuid-789",
  "user_email": "editor@company.com",
  "data": {
    "contentTitle": "New Blog Post",
    "contentType": "blog",
    "publishDate": "2024-01-15",
    "authorName": "John Doe",
    "contentStatus": "draft"
  },
  "action": "process"
}
```

**N8N Workflow Logic:**
```javascript
// Access your fields
const contentTitle = $json.data.contentTitle;
const contentType = $json.data.contentType;
const publishDate = $json.data.publishDate;

// Process your business logic
if (contentStatus === "draft") {
  // Send to review queue
  // Notify editors
  // Schedule publication
}

// Update database with processed values
// Send webhook response
```

## 🔒 **Security Pattern**

### Authentication
All N8N requests include authentication headers:

```javascript
// In your N8N workflow, verify the webhook secret
if (headers['x-webhook-secret'] !== 'your-secure-secret') {
  return { error: 'Unauthorized' };
}
```

### Field Validation
The template automatically validates field names:

```javascript
// Safe field pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/
// System fields are protected: UID, created_at, updated_at
```

## 📡 **Real-time Update Pattern**

### Step 1: N8N Receives Data
```json
{
  "user_id": "uuid",
  "data": { "yourField": "value" }
}
```

### Step 2: N8N Processes Data
```javascript
// Your workflow logic here
const processedValue = processField($json.data.yourField);

// Update database directly
await updateDatabase(processedValue);
```

### Step 3: N8N Sends Webhook
```json
{
  "user_id": "uuid",
  "updatedFields": ["yourField"]
}
```

### Step 4: UI Updates Automatically
- Webhook received by template
- Database values fetched
- UI highlights updated fields
- Real-time display refreshes

## 🚀 **Template Workflow Creation**

### Standard N8N Workflow Template

1. **Webhook Trigger Node**
   - Method: POST
   - Path: `/webhook/your-endpoint`
   - Authentication: Header `x-webhook-secret`

2. **Field Access Node**
   ```javascript
   const userData = $json.data;
   const userId = $json.user_id;
   const userEmail = $json.user_email;
   
   // Access any field by name
   const yourField1 = userData.yourField1;
   const yourField2 = userData.yourField2;
   ```

3. **Business Logic Node**
   ```javascript
   // Your custom processing logic
   if (yourField1 === "condition") {
     // Process logic
   }
   ```

4. **Database Update Node**
   ```javascript
   // Update your database directly
   await updateDatabase({
     user_id: userId,
     yourField1: processedValue1,
     yourField2: processedValue2
   });
   ```

5. **Webhook Response Node**
   ```javascript
   return {
     user_id: $json.user_id,
     updatedFields: ["yourField1", "yourField2"]
   };
   ```

## 🔧 **Template Customization**

### Custom Field Processing
```javascript
// Template pattern for any field processing
const processField = (fieldName, value) => {
  switch (fieldName) {
    case 'customerEmail':
      return value.toLowerCase();
    case 'orderTotal':
      return parseFloat(value).toFixed(2);
    case 'publishDate':
      return new Date(value).toISOString();
    default:
      return value;
  }
};
```

### Conditional Logic
```javascript
// Template pattern for conditional processing
const processOrder = (orderData) => {
  if (orderData.orderQuantity > 10) {
    orderData.discount = "bulk";
    orderData.priority = "high";
  }
  
  if (orderData.paymentStatus === "paid") {
    orderData.fulfillmentStatus = "ready";
  }
  
  return orderData;
};
```

### Multi-step Workflows
```javascript
// Template pattern for complex workflows
const processCustomerSupport = async (ticketData) => {
  // Step 1: Analyze sentiment
  const sentiment = await analyzeSentiment(ticketData.customerMessage);
  
  // Step 2: Route based on category
  const agent = await routeTicket(ticketData.issueCategory);
  
  // Step 3: Set priority
  const priority = calculatePriority(sentiment, ticketData.issueCategory);
  
  return {
    assignedAgent: agent,
    priorityLevel: priority,
    sentimentScore: sentiment
  };
};
```

## 🎯 **Template Testing**

### Test Payload
```json
{
  "user_id": "test-user-123",
  "user_email": "test@example.com",
  "data": {
    "testField1": "test value 1",
    "testField2": "test value 2"
  },
  "action": "process"
}
```

### Expected Response
```json
{
  "user_id": "test-user-123",
  "updatedFields": ["testField1", "testField2"]
}
```

## 🏆 **Template Benefits**

- **🔄 Consistent Integration**: Same pattern for any field configuration
- **🔒 Built-in Security**: Authentication and validation included
- **📡 Real-time Updates**: Automatic UI refresh after processing
- **🎯 Type Safety**: Structured data flow with validation
- **🚀 Rapid Development**: Build workflows in minutes, not hours

## 📞 **Template Support**

### Troubleshooting
- **Connection Issues**: Verify `N8N_BASE_URL` and `N8N_WEBHOOK_SECRET`
- **Field Issues**: Check field names match your `DEVELOPMENT_FIELDS` array
- **Webhook Issues**: Ensure response includes correct `user_id` and `updatedFields`

### Best Practices
- Always validate the webhook secret
- Include error handling in your workflows
- Use structured logging for debugging
- Test with different field configurations

---

**🚀 Ready to build your N8N workflows?** Start with one of the template examples above and customize for your specific use case!
