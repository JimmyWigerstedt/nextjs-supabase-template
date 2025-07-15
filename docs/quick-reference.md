# Quick Reference Guide

## 🚀 **Template Adaptation Checklist**

### 1. **Copy Template Component**
```bash
# Copy from existing template
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-page/page.tsx
```

### 2. **Configure Field Arrays**
```typescript
// INPUT_FIELDS: Form data sent to N8N (no database columns needed)
const INPUT_FIELDS = [
  'customerEmail',    // Form input → N8N payload → cleared
  'productSku',       // Form input → N8N payload → cleared  
  'orderQuantity'     // Form input → N8N payload → cleared
];

// EXPECTED_RESULTS_SCHEMA: Expected outputs from N8N workflow
const EXPECTED_RESULTS_SCHEMA = [
  'orderStatus',      // Expected from N8N → stored in results table
  'trackingNumber',   // Expected from N8N → stored in results table
  'customerNotes'     // Expected from N8N → stored in results table
];

// WORKFLOW_ID: Unique identifier for this workflow
const WORKFLOW_ID = 'your-workflow-name';
```

### 3. **Database Setup**
```bash
# Results table is automatically created - no manual setup needed
# Optional: Add fields to userData table for user profile data
npm run add-field customUserField
```

### 4. **Update Component Details**
```typescript
// Component name
export function YourPageClient() {

// Page title
<CardTitle>Your Page Title</CardTitle>

// Field labels (optional)
const formatFieldName = (fieldName: string) => {
  // Your custom display names
  const labels = {
    'customerEmail': 'Customer Email',
    'productSku': 'Product SKU'
  };
  return labels[fieldName] || fieldName;
};
```

### 5. **N8N Workflow Setup**

Your workflow receives:
```json
{
  "user_id": "uuid",
  "user_email": "email@example.com",
  "usage_credits": 1000,
  "data": {
    "customerEmail": "value",
    "productSku": "value",
    "orderQuantity": "value"
  },
  "action": "process",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_id": "your-workflow-name",
  "expected_results_schema": ["orderStatus", "trackingNumber"]
}
```

Your workflow should send back via webhook:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "results": {
    "orderStatus": "processing",
    "trackingNumber": "1Z999AA1234567890"
  },
  "credits_used": 10
}
```

## 🏗️ **File Structure**

```
src/app/your-new-page/
├── page.tsx           # Server component (copy exactly)
└── client-page.tsx    # Main component (customize this)
```

## 🎯 **What to Copy vs Customize**

### **Copy Exactly (Never Modify)**
- All import statements
- All state declarations  
- All tRPC mutation setup
- SSE connection logic
- Helper functions (`updateInputField`, `updateEditableField`, `getFieldHighlight`)
- Button click handlers (`handleSendToN8n`, `handleSaveField`)

### **Customize These**
- `INPUT_FIELDS` array
- `EXPECTED_RESULTS_SCHEMA` array
- `WORKFLOW_ID` constant
- Component name
- Page title and descriptions
- Field formatting functions
- UI layout and styling
- Card organization

## 🔧 **Environment Variables**

```bash
# Database connections
DATABASE_URL="your-supabase-database-url"
INTERNAL_DATABASE_URL="your-railway-postgresql-url"

# N8N Integration
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-secure-webhook-secret-min-32-chars"
N8N_TIMEOUT=30000

# Schema Configuration
NC_SCHEMA="pjo77o6pg08pd9l"
```

## 🔄 **Common Patterns**

### **Run History Management**
```typescript
// Get workflow history
const { data: workflowHistory, refetch: refetchHistory } = 
  api.internal.getWorkflowHistory.useQuery();

// Get specific run details
const { data: runDetails } = api.internal.getRunDetails.useQuery({ runId });

// Delete run from history
const { mutate: deleteRun } = api.internal.deleteRun.useMutation();
```

### **Field Validation**
```typescript
// Input validation patterns
const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validatePhone = (value: string) => /^\d{10}$/.test(value);
const validateDate = (value: string) => !isNaN(Date.parse(value));
```

### **Field Formatting**
```typescript
// Custom field display names
const formatFieldName = (fieldName: string) => {
  const labels = {
    'customerEmail': 'Customer Email Address',
    'productSku': 'Product SKU',
    'orderQuantity': 'Order Quantity'
  };
  return labels[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
};
```

### **Business Logic Hooks**
```typescript
// Add custom pre-processing before sending to N8N
const handleSendToN8n = () => {
  // Custom validation
  if (inputData.orderQuantity && parseInt(inputData.orderQuantity) > 100) {
    toast.error("Large orders require manager approval");
    return;
  }
  
  // Data transformation
  const processedData = {
    ...inputData,
    orderQuantity: parseInt(inputData.orderQuantity)
  };
  
  // Send with results tracking
  sendToN8n({
    data: processedData,
    workflow_id: WORKFLOW_ID,
    expected_results_schema: EXPECTED_RESULTS_SCHEMA
  });
};
```

## 📊 **Results Table Management**

### **Results Table Schema**
- `id` (UUID primary key)
- `user_id` (user identifier)
- `workflow_id` (workflow identifier)
- `status` (running, completed, failed, or custom)
- `input_data` (JSONB - original form data)
- `results` (JSONB - N8N workflow results)
- `expected_results_schema` (JSONB - expected output fields)
- `credits_used` (INTEGER - credit consumption)
- `created_at`, `updated_at`, `completed_at` (timestamps)

### **Status Values**
- `running` - Workflow in progress
- `completed` - Workflow finished successfully
- `failed` - Workflow encountered an error
- Custom statuses - Any freetext for workflow-specific updates

### **JSONB Field Structure**
```typescript
// input_data example
{
  "customerEmail": "customer@example.com",
  "productSku": "PROD-123",
  "orderQuantity": "2"
}

// results example
{
  "orderStatus": "processing",
  "trackingNumber": "1Z999AA1234567890",
  "customerNotes": "Rush delivery"
}
```

## 🔍 **Debug Commands**

### **Database Connection**
```bash
# Test database connection
npm run dev
# Visit /n8n-demo and check run history loads
```

### **Results Table Verification**
```bash
# Check results table structure
# Visit /n8n-demo and click "Show Debug Info"
# Check workflow history for run records
```

### **N8N Integration Testing**
```bash
# Check browser network tab when sending to N8N
# Look for POST requests to /api/trpc/internal.sendToN8n
# Monitor run status changes in real-time
# Verify webhook responses in browser console
```

## 🚀 **Performance Tips**

### **Development Mode**
```bash
# Hot reload for faster development
npm run dev

# Clear cache if needed
rm -rf .next/cache
```

### **Production Optimization**
```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🎨 **UI Customization**

### **Card Layout**
```typescript
// Add custom card sections
<Card>
  <CardHeader>
    <CardTitle>Your Section Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Your custom content */}
  </CardContent>
</Card>
```

### **Field Grouping**
```typescript
// Group related fields
const CONTACT_FIELDS = ['customerEmail', 'customerPhone'];
const ORDER_FIELDS = ['productSku', 'orderQuantity'];
```

### **Conditional Display**
```typescript
// Show/hide fields based on conditions
{userData?.userType === 'admin' && (
  <div>Admin-only fields</div>
)}
```

## 🔐 **Security Checklist**

- [ ] Environment variables configured
- [ ] N8N webhook secret validated
- [ ] Database connections secured
- [ ] Field validation enabled
- [ ] Authentication required
- [ ] Error logging configured

## 📋 **Testing Checklist**

- [ ] All INPUT_FIELDS display correctly
- [ ] EXPECTED_RESULTS_SCHEMA properly defined
- [ ] WORKFLOW_ID set correctly
- [ ] N8N receives correct payload format with run_id
- [ ] N8N returns correct webhook response
- [ ] Results table records created properly
- [ ] Real-time status updates work
- [ ] Run history displays correctly
- [ ] Delete functionality works
- [ ] Error handling works
- [ ] Field validation works

---

**🔗 For detailed field configuration examples, see the [Complete Template Guide](./complete-template-guide.md)** 