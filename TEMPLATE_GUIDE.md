# Template Usage Guide - Complete Adaptation Reference

**🎯 Purpose:** This guide shows you how to adapt this template for any N8N workflow use case in minutes, not hours.

**⚡ Core Principle:** Define your fields → Copy the component → Test immediately

## 📋 Template Overview

### **What This Template Provides**
- **Pre-built N8N integration** with complete workflow tracking
- **Results table system** for audit trails and run history
- **Real-time status updates** via Server-Sent Events
- **Dynamic field handling** that adapts to any use case
- **Type-safe APIs** from database to UI

### **Field Concepts (Critical Understanding)**
```typescript
// INPUT_FIELDS: Form data → N8N payload → cleared after send
const INPUT_FIELDS = ['customerEmail', 'productSku', 'orderQuantity'];

// EXPECTED_RESULTS_SCHEMA: N8N outputs → stored in results table
const EXPECTED_RESULTS_SCHEMA = {
  orderStatus: 'string',
  trackingNumber: 'string', 
  customerNotes: 'string'
};

// WORKFLOW_ID: Unique identifier for this specific workflow
const WORKFLOW_ID = 'order-processing';
```

### **Data Flow Architecture**
```
📝 User fills INPUT_FIELDS 
    ↓
🔄 Results record created with 'processing' status
    ↓
📤 N8N receives payload with run tracking ID
    ↓
⚙️ N8N processes business logic (black box)
    ↓
📥 N8N sends webhook with results matching EXPECTED_RESULTS_SCHEMA
    ↓
📊 Results table updated with output_data and status
    ↓
🔴 Real-time UI update via SSE (live status changes)
    ↓
📋 Complete audit trail preserved forever
```

## 🚀 5-Minute Adaptation Process

### **Step 1: Choose Your Use Case (30 seconds)**

Pick from these proven patterns or create your own:

**E-commerce Order Processing**
```typescript
const INPUT_FIELDS = ['customerEmail', 'productSku', 'orderQuantity', 'shippingAddress'];
const EXPECTED_RESULTS_SCHEMA = {
  orderStatus: 'string',
  trackingNumber: 'string', 
  estimatedDelivery: 'string',
  orderTotal: 'number'
};
const WORKFLOW_ID = 'ecommerce-order-processing';
```

**Customer Support System**
```typescript
const INPUT_FIELDS = ['ticketSubject', 'issueCategory', 'priorityLevel', 'customerMessage'];
const EXPECTED_RESULTS_SCHEMA = {
  assignedAgent: 'string',
  ticketStatus: 'string',
  estimatedResolution: 'string',
  escalationLevel: 'string'
};
const WORKFLOW_ID = 'support-ticket-routing';
```

**Content Management**
```typescript
const INPUT_FIELDS = ['contentTitle', 'contentType', 'publishDate', 'authorName'];
const EXPECTED_RESULTS_SCHEMA = {
  contentStatus: 'string',
  publishedUrl: 'string',
  seoScore: 'number',
  approvalStatus: 'string'
};
const WORKFLOW_ID = 'content-publishing';
```

**Financial Services**
```typescript
const INPUT_FIELDS = ['applicantName', 'loanAmount', 'annualIncome', 'creditHistory'];
const EXPECTED_RESULTS_SCHEMA = {
  creditScore: 'number',
  applicationStatus: 'string',
  approvalAmount: 'number',
  interestRate: 'number'
};
const WORKFLOW_ID = 'loan-application-processing';
```

**Healthcare Management**
```typescript
const INPUT_FIELDS = ['patientName', 'symptoms', 'medicalHistory', 'urgencyLevel'];
const EXPECTED_RESULTS_SCHEMA = {
  triageLevel: 'string',
  assignedDoctor: 'string',
  appointmentTime: 'string',
  recommendedTests: 'string'
};
const WORKFLOW_ID = 'patient-intake-processing';
```

### **Step 2: Copy Template Component (30 seconds)**
```bash
# Copy the template structure
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-page/page.tsx
```

### **Step 3: Update Field Configuration (2 minutes)**

Open `src/app/your-page/client-page.tsx` and update these sections:

**🔧 Required Changes:**
```typescript
// Line ~48: Update INPUT_FIELDS array
const INPUT_FIELDS = [
  'yourInputField1',    // Replace with your form fields
  'yourInputField2',
  'yourInputField3'
];

// Line ~61: Update EXPECTED_RESULTS_SCHEMA object
const EXPECTED_RESULTS_SCHEMA = {
  yourResultField1: 'string',    // Replace with your expected outputs
  yourResultField2: 'number',
  yourResultField3: 'string'
} as const;

// Line ~68: Update WORKFLOW_ID
const WORKFLOW_ID = 'your-workflow-name';

// Line ~76: Update component name
export function YourPageClient() {

// Line ~408: Update page title
<CardTitle>Your Custom Page Title</CardTitle>
```

**🎨 Optional Customizations:**
```typescript
// Custom field labels (around line 517)
const formatFieldName = (fieldName: string) => {
  const labels = {
    'yourInputField1': 'Your Custom Label 1',
    'yourInputField2': 'Your Custom Label 2'
  };
  return labels[fieldName] || fieldName;
};
```

### **Step 4: Test Integration (2 minutes)**
```bash
npm run dev
# Visit http://localhost:3000/your-page
# Fill out the form and click "Send to N8N"
# Watch the run history section for real-time updates
```

## 🔄 N8N Workflow Integration

### **Standard Payload Your N8N Receives**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "id": "results-tracking-uuid",
  "workflow_id": "your-workflow-name", 
  "user_email": "user@example.com",
  "usage_credits": 1000,
  "data": {
    "yourInputField1": "user_input_value",
    "yourInputField2": "user_input_value",
    "yourInputField3": "user_input_value"
  },
  "expected_results_schema": {
    "yourResultField1": "string",
    "yourResultField2": "number",
    "yourResultField3": "string"
  },
  "action": "process"
}
```

### **Standard Response Your N8N Should Send**
```json
{
  "id": "same-results-tracking-uuid-from-request",
  "status": "completed",
  "output_data": {
    "yourResultField1": "processed_value",
    "yourResultField2": 42,
    "yourResultField3": "calculated_result"
  },
  "credit_cost": 25
}
```

### **N8N Workflow Template**
```javascript
// 1. Receive webhook payload
const { data, id, workflow_id, expected_results_schema, usage_credits } = $json;

// 2. Extract your specific input fields
const { yourInputField1, yourInputField2, yourInputField3 } = data;

// 3. Process your business logic
const processedResult1 = processYourLogic(yourInputField1);
const calculatedResult2 = calculateSomething(yourInputField2);
const derivedResult3 = deriveValue(yourInputField3);

// 4. Send progress update (optional)
await $http.request({
  method: 'POST',
  url: 'YOUR_APP_URL/api/webhooks/internal-updated',
  headers: { 'x-webhook-secret': 'YOUR_WEBHOOK_SECRET' },
  body: {
    id: id,
    status: 'analyzing'
  }
});

// 5. Continue processing...

// 6. Send completion with results
await $http.request({
  method: 'POST',
  url: 'YOUR_APP_URL/api/webhooks/internal-updated', 
  headers: { 'x-webhook-secret': 'YOUR_WEBHOOK_SECRET' },
  body: {
    id: id,
    status: 'completed',
    output_data: {
      yourResultField1: processedResult1,
      yourResultField2: calculatedResult2,
      yourResultField3: derivedResult3
    },
    credit_cost: 25
  }
});
```

## 📊 Results Table System

### **Automatic Features**
- **No setup required** - Results table auto-created
- **UUID primary keys** - Unique tracking for every run
- **JSONB storage** - Flexible input/output data structure
- **Performance indexes** - Optimized queries for user and workflow
- **Complete audit trail** - Every execution preserved permanently

### **Real-time Status Tracking**
```typescript
// Status progression examples
'processing' → 'analyzing' → 'completed'
'processing' → 'failed' 
'processing' → 'pending_approval' → 'completed'
'processing' → 'requires_input' → 'processing' → 'completed'
```

### **Run History Features**
- **Expandable details** - Click any run to see full input/output
- **Performance metrics** - Execution time and credit consumption  
- **Delete functionality** - Remove runs from history
- **Real-time updates** - Live status changes during execution
- **Status indicators** - Visual badges for run states

## 🎯 Advanced Use Case Examples

### **Multi-Step Business Process**
```typescript
// Loan application with multiple approval stages
const INPUT_FIELDS = ['applicantData', 'financialInfo', 'documents'];
const EXPECTED_RESULTS_SCHEMA = {
  creditCheck: 'string',      // First step result
  incomeVerification: 'string', // Second step result  
  finalDecision: 'string',    // Final approval
  loanTerms: 'object'         // Complete terms if approved
};

// N8N can send multiple status updates:
// 'processing' → 'credit_checking' → 'income_verification' → 'final_review' → 'completed'
```

### **Content Workflow with Approvals**
```typescript
const INPUT_FIELDS = ['articleContent', 'publishDate', 'targetAudience'];
const EXPECTED_RESULTS_SCHEMA = {
  seoAnalysis: 'object',      // SEO recommendations
  editorReview: 'string',     // Editor feedback
  publishStatus: 'string',    // Publication status
  finalUrl: 'string'          // Published URL
};

// N8N workflow: content analysis → editor review → publication
```

### **E-commerce with Inventory Integration**
```typescript
const INPUT_FIELDS = ['productSelection', 'quantity', 'customerInfo'];
const EXPECTED_RESULTS_SCHEMA = {
  inventoryStatus: 'string',   // Stock availability
  pricingInfo: 'object',      // Dynamic pricing
  shippingOptions: 'array',   // Available shipping
  orderConfirmation: 'string' // Final order details
};

// N8N workflow: inventory check → pricing calculation → shipping options → order creation
```

## 🔧 Component Customization

### **Field Display Customization**
```typescript
// Custom field formatting
const formatFieldName = (fieldName: string) => {
  const labels = {
    'customerEmail': 'Customer Email Address',
    'productSku': 'Product SKU',
    'orderQuantity': 'Order Quantity',
    'shippingAddress': 'Shipping Address'
  };
  return labels[fieldName] || 
    fieldName.charAt(0).toUpperCase() + 
    fieldName.slice(1).replace(/([A-Z])/g, ' $1');
};

// Custom validation
const validateField = (fieldName: string, value: string) => {
  switch (fieldName) {
    case 'customerEmail':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'orderQuantity':
      return parseInt(value) > 0 && parseInt(value) <= 100;
    default:
      return value.trim().length > 0;
  }
};
```

### **UI Layout Customization**
```typescript
// Custom card organization
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <Card>
    {/* Input fields */}
  </Card>
  <Card>
    {/* Run history */}
  </Card>
  <Card>
    {/* Custom status dashboard */}
  </Card>
</div>

// Custom styling
const getStatusColor = (status: string) => {
  const colors = {
    'processing': 'bg-blue-500',
    'completed': 'bg-green-500', 
    'failed': 'bg-red-500',
    'pending_approval': 'bg-yellow-500'
  };
  return colors[status] || 'bg-gray-500';
};
```

### **Business Logic Integration**
```typescript
// Pre-processing before N8N
const handleSendToN8n = () => {
  // Custom validation
  if (inputData.orderQuantity && parseInt(inputData.orderQuantity) > 100) {
    toast.error("Large orders require manager approval");
    return;
  }
  
  // Data transformation
  const processedData = {
    ...inputData,
    orderQuantity: parseInt(inputData.orderQuantity),
    orderTotal: calculateTotal(inputData),
    processingPriority: determinePriority(inputData)
  };
  
  sendToN8n({
    data: processedData,
    workflow_id: WORKFLOW_ID,
    expected_results_schema: EXPECTED_RESULTS_SCHEMA
  });
};
```

## 🔍 Debugging and Troubleshooting

### **Common Issues and Solutions**

**Issue: Form fields not displaying**
```typescript
// Check: INPUT_FIELDS array is properly defined
const INPUT_FIELDS = ['field1', 'field2']; // ✅ Correct
const INPUT_FIELDS = 'field1,field2';      // ❌ Wrong type
```

**Issue: N8N payload format incorrect**
```typescript
// Check: EXPECTED_RESULTS_SCHEMA uses object format
const EXPECTED_RESULTS_SCHEMA = {           // ✅ Correct
  result1: 'string',
  result2: 'number'
};
const EXPECTED_RESULTS_SCHEMA = ['result1']; // ❌ Wrong format
```

**Issue: Real-time updates not working**
```bash
# Check browser console for SSE connection
# Look for: "SSE connection established"
# Verify webhook secret matches between app and N8N
```

**Issue: Run history not updating**
```typescript
// Check: N8N sends webhook with correct format
{
  "id": "must-match-original-request-id",
  "status": "completed",
  "output_data": { /* results */ }
}
```

### **Debug Tools**
```typescript
// Enable debug mode in component
const [showDebug, setShowDebug] = useState(true);

// Check run details
const { data: runDetails } = api.internal.getRunDetails.useQuery({ runId });

// Monitor SSE messages
eventSource.onmessage = (event) => {
  console.log('SSE received:', JSON.parse(event.data));
};
```

## ✅ Validation Checklist

### **Template Adaptation Complete When:**
- [ ] INPUT_FIELDS array updated with your form fields
- [ ] EXPECTED_RESULTS_SCHEMA object updated with your expected outputs  
- [ ] WORKFLOW_ID set to your unique workflow identifier
- [ ] Component name updated (optional)
- [ ] Page title updated (optional)
- [ ] Form displays all input fields correctly
- [ ] "Send to N8N" creates run record in history
- [ ] N8N receives payload with your field data
- [ ] N8N webhook updates run status in real-time
- [ ] Run history shows complete audit trail
- [ ] Error handling works for failed workflows

### **N8N Integration Working When:**
- [ ] Webhook receives correct payload format with run tracking ID
- [ ] N8N can access all fields from data object
- [ ] N8N sends status updates during processing
- [ ] N8N sends final webhook with output_data matching schema
- [ ] UI updates in real-time during workflow execution
- [ ] Completed runs show full input/output details
- [ ] Failed runs show error messages and details

---

**🎯 Success Metrics:** With this template, you can build production-ready workflow applications in 5-10 minutes instead of 2-3 hours. The complete audit trail, real-time tracking, and type safety are included automatically.

**🚀 Next Steps:** Once your basic integration works, explore advanced features like custom validation, multi-step workflows, and UI customization to match your specific business requirements.