# N8N Template Adaptation Guide

## 🎯 **Template Philosophy**

This template enables **rapid adaptation** for any data processing use case with N8N workflows. The system treats N8N as a **black box** - you only need to understand input/output patterns, not workflow internals.

**Core Pattern:**
```
User Input → Send to N8N → N8N Processing (black box) → UI Updates
```

## 📋 **Template Structure**

### **NEVER MODIFY (Core Template)**
```typescript
// SSE connection, tRPC mutations, real-time updates
// These sections handle the communication infrastructure
```

### **ALWAYS CUSTOMIZE (Field Configuration)**
```typescript
// Input fields - form data sent to N8N (no database persistence)
const INPUT_FIELDS = [
  'yourField1',
  'yourField2',
  'yourField3'
];

// Persistent fields - store N8N results or user data (require database columns)
const PERSISTENT_FIELDS = [
  'aiResult',      // N8N analysis result (read-only)
  'userNotes'      // User can edit and save
];
```

### **OPTIONALLY CUSTOMIZE (UI & Validation)**
```typescript
// Form validation, styling, field labels
// Customize based on your specific UI requirements
```

## 🔧 **5-Minute Template Adaptation**

### **Step 1: Define Your Fields**
Replace the field arrays with your use case:

```typescript
// Example: E-commerce Order Processing
const INPUT_FIELDS = [
  'customerEmail',
  'productSku', 
  'orderQuantity',
  'shippingAddress'
];

const PERSISTENT_FIELDS = [
  'orderStatus',      // N8N sets this (read-only)
  'trackingNumber',   // N8N sets this (read-only)
  'customerNotes'     // User can edit this
];
```

### **Step 2: Add Database Columns**
Run the field addition script:
```bash
node scripts/add-field.js orderStatus
node scripts/add-field.js trackingNumber
node scripts/add-field.js customerNotes
```

### **Step 3: Copy Template Component**
```bash
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-page/page.tsx
```

### **Step 4: Update Field Arrays**
In your copied component, replace the field arrays with your configuration from Step 1.

### **Step 5: Create N8N Workflow**
Your N8N workflow receives this **standardized payload**:
```json
{
  "user_id": "supabase-user-uuid",
  "user_email": "user@example.com", 
  "data": {
    "customerEmail": "customer@example.com",
    "productSku": "PROD-123",
    "orderQuantity": "2",
    "shippingAddress": "123 Main St"
  },
  "action": "process"
}
```

Your N8N workflow must return this **standardized response**:
```json
{
  "user_id": "same-user-uuid",
  "updatedFields": ["orderStatus", "trackingNumber"]
}
```

## 📚 **Use Case Library**

### **E-commerce Order Processing**
```typescript
const INPUT_FIELDS = [
  'customerEmail', 'productSku', 'orderQuantity', 'shippingAddress', 'paymentMethod'
];

const PERSISTENT_FIELDS = [
  'orderStatus',      // N8N: "pending" | "processing" | "shipped" | "delivered"
  'trackingNumber',   // N8N: shipping carrier tracking code
  'estimatedDelivery', // N8N: calculated delivery date
  'customerNotes'     // User: editable order notes
];
```

### **Customer Support Tickets**
```typescript
const INPUT_FIELDS = [
  'ticketSubject', 'issueCategory', 'priorityLevel', 'customerMessage'
];

const PERSISTENT_FIELDS = [
  'assignedAgent',    // N8N: auto-assigned based on category
  'ticketStatus',     // N8N: "open" | "in-progress" | "resolved" | "closed"
  'estimatedResolution', // N8N: calculated SLA deadline
  'internalNotes'     // User: editable agent notes
];
```

### **Content Management**
```typescript
const INPUT_FIELDS = [
  'contentTitle', 'contentType', 'publishDate', 'authorName', 'contentBody'
];

const PERSISTENT_FIELDS = [
  'contentStatus',    // N8N: "draft" | "review" | "approved" | "published"
  'reviewerNotes',    // N8N: automated content analysis
  'seoScore',         // N8N: SEO analysis result
  'editorComments'    // User: editable editorial notes
];
```

### **CRM Lead Management**
```typescript
const INPUT_FIELDS = [
  'leadName', 'leadEmail', 'leadPhone', 'leadSource', 'leadInterest'
];

const PERSISTENT_FIELDS = [
  'leadScore',        // N8N: calculated lead qualification score
  'assignedSales',    // N8N: auto-assigned sales rep
  'nextAction',       // N8N: recommended next step
  'salesNotes'        // User: editable sales notes
];
```

### **Financial Transaction Processing**
```typescript
const INPUT_FIELDS = [
  'transactionAmount', 'transactionType', 'merchantId', 'customerId'
];

const PERSISTENT_FIELDS = [
  'riskScore',        // N8N: fraud risk assessment
  'transactionStatus', // N8N: "approved" | "declined" | "pending"
  'complianceNotes',  // N8N: regulatory compliance notes
  'reviewNotes'       // User: editable review notes
];
```

### **HR Application Processing**
```typescript
const INPUT_FIELDS = [
  'applicantName', 'applicantEmail', 'positionApplied', 'resumeUrl'
];

const PERSISTENT_FIELDS = [
  'skillsMatch',      // N8N: calculated skills compatibility score
  'applicationStatus', // N8N: "screening" | "interview" | "offer" | "rejected"
  'interviewDate',    // N8N: scheduled interview time
  'hrNotes'          // User: editable HR notes
];
```

## 🔒 **Security & Environment**

### **Required Environment Variables**
```bash
# N8N Integration
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-secure-webhook-secret-at-least-32-chars"
N8N_TIMEOUT=30000

# Database
INTERNAL_DATABASE_URL="postgresql://user:pass@host:5432/database"
NC_SCHEMA="public"
```

### **N8N Workflow Security**
```javascript
// Always validate the webhook secret in your N8N workflow
if (headers['x-webhook-secret'] !== 'your-secure-secret') {
  return { error: 'Unauthorized' };
}
```

## 🎯 **Template Customization Points**

### **Field Labels & Validation**
```typescript
// Customize field labels in the UI
<Label htmlFor={`${fieldName}-input`}>
  {fieldName === 'customerEmail' ? 'Customer Email Address' : 
   fieldName === 'productSku' ? 'Product SKU' :
   fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
</Label>

// Add custom validation
const validateField = (fieldName: string, value: string) => {
  if (fieldName === 'customerEmail' && !value.includes('@')) {
    return 'Please enter a valid email address';
  }
  return null;
};
```

### **UI Styling**
```typescript
// Customize field styling
<Input
  className={`${getFieldHighlight(fieldName)} ${
    fieldName === 'priorityLevel' ? 'border-red-300' : ''
  }`}
  placeholder={`Enter ${fieldName}`}
/>
```

### **Business Logic**
```typescript
// Add custom business logic
const handleSendToN8n = () => {
  // Add custom validation before sending
  if (inputData.orderQuantity && parseInt(inputData.orderQuantity) > 100) {
    toast.error("Large orders require manager approval");
    return;
  }
  
  // Process normally
  sendToN8n(dataToSend);
};
```

## 🚀 **Real-Time Updates**

The template automatically handles real-time updates when N8N completes processing:

1. **N8N processes your data** (black box)
2. **N8N updates database** with results
3. **N8N sends webhook** with `updatedFields` array
4. **UI automatically refreshes** and highlights updated fields
5. **User sees results** in real-time

## ✅ **Template Validation**

Your template adaptation is successful when:

- [ ] Field arrays match your use case
- [ ] Database columns exist for all `PERSISTENT_FIELDS`
- [ ] N8N workflow receives standardized payload
- [ ] N8N workflow returns standardized response
- [ ] UI displays input and persistent fields correctly
- [ ] Real-time updates work after N8N processing

## 🛠️ **Troubleshooting Template Issues**

### **Common Field Configuration Errors**
- **Missing database columns**: Run `node scripts/add-field.js fieldName`
- **Typo in field names**: Check spelling consistency across arrays
- **Wrong field type**: Ensure INPUT_FIELDS are sent to N8N, PERSISTENT_FIELDS are stored

### **N8N Integration Errors**
- **Connection failed**: Verify `N8N_BASE_URL` and `N8N_WEBHOOK_SECRET`
- **Payload format**: Ensure workflow expects standardized payload structure
- **Response format**: Ensure workflow returns `{user_id, updatedFields}` format

### **Real-Time Update Errors**
- **No updates**: Check N8N webhook sends correct response format
- **Wrong fields highlighted**: Verify `updatedFields` array matches database columns
- **UI not refreshing**: Check SSE connection status indicator

---

**🚀 Ready to build your custom application?** Pick a use case from the library above, follow the 5-minute adaptation steps, and you'll have a working N8N integration in minutes! 