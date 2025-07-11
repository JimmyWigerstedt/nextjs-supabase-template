# N8N Integration Guide

## 🎯 **Template Philosophy**

This template enables **rapid adaptation** for any data processing use case with N8N workflows. The system treats N8N as a **black box** - you only need to understand input/output patterns, not workflow internals.

**Core Pattern:**
```
User Input → Send to N8N → N8N Processing (black box) → UI Updates
```

## 📋 **Field Types Distinction**

### **INPUT_FIELDS**
- **Purpose**: Form data sent to N8N for processing
- **Lifecycle**: User input → N8N payload → cleared after send
- **Database**: No database columns needed
- **UI**: Form inputs only

### **PERSISTENT_FIELDS**
- **Purpose**: Database columns that store N8N results or user data
- **Lifecycle**: Database → display/edit → real-time updates
- **Database**: Requires database columns (add with `npm run add-field`)
- **UI**: Display current values + edit inputs

## ⚡ **5-Minute Setup Process**

### **Step 1: Pick Your Use Case** (30 seconds)
- [ ] Review the [Field Configuration Library](#field-configuration-library) below
- [ ] Select the closest match to your use case
- [ ] Copy the `INPUT_FIELDS` and `PERSISTENT_FIELDS` arrays

### **Step 2: Copy Template Files** (30 seconds)
```bash
# Copy the template component files
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-page/page.tsx
```

### **Step 3: Configure Field Arrays** (1 minute)
- [ ] Open `src/app/your-page/client-page.tsx`
- [ ] Replace the `INPUT_FIELDS` array with your fields
- [ ] Replace the `PERSISTENT_FIELDS` array with your fields
- [ ] Save the file

### **Step 4: Add Database Columns** (2 minutes)
Run the add-field script for each `PERSISTENT_FIELD`:
```bash
# Example commands (replace with your actual field names)
node scripts/add-field.js orderStatus
node scripts/add-field.js trackingNumber
node scripts/add-field.js customerNotes
```

### **Step 5: Test the Integration** (1 minute)
- [ ] Start your development server
- [ ] Visit `/your-page` in your browser
- [ ] Verify form fields display correctly
- [ ] Test the "Send to N8N" button (will fail until N8N is configured)

## 🔧 **N8N Workflow Setup**

### **Step 6: Configure N8N Workflow** (2 minutes)
1. **Create webhook endpoint** in N8N
2. **Update endpoint URL** in `src/server/api/routers/internal.ts`:
   ```typescript
   // Find this line and update the endpoint:
   const response = await fetch(`${env.N8N_BASE_URL}/webhook/your-n8n-endpoint`, {
   ```
3. **Add webhook secret validation** in your N8N workflow:
   ```javascript
   if (headers['x-webhook-secret'] !== 'your-secret') {
     return { error: 'Unauthorized' };
   }
   ```

### **Step 7: Test Complete Integration** (1 minute)
- [ ] Send test data through the form
- [ ] Verify N8N receives the standardized payload
- [ ] Check that N8N webhook returns the correct response format
- [ ] Confirm real-time UI updates work

## 📚 **Field Configuration Library**

### **E-commerce & Retail**

#### **Order Processing**
```typescript
const INPUT_FIELDS = [
  'customerEmail', 'productSku', 'orderQuantity', 'shippingAddress', 'paymentMethod'
];
const PERSISTENT_FIELDS = [
  'orderStatus', 'trackingNumber', 'estimatedDelivery', 'customerNotes'
];
```
**Database Commands:**
```bash
node scripts/add-field.js orderStatus
node scripts/add-field.js trackingNumber
node scripts/add-field.js estimatedDelivery
node scripts/add-field.js customerNotes
```

#### **Inventory Management**
```typescript
const INPUT_FIELDS = [
  'productName', 'productCategory', 'supplierName', 'orderQuantity', 'urgencyLevel'
];
const PERSISTENT_FIELDS = [
  'restockStatus', 'supplierResponse', 'deliveryDate', 'inventoryNotes'
];
```

#### **Customer Returns**
```typescript
const INPUT_FIELDS = [
  'orderId', 'returnReason', 'returnCondition', 'refundPreference'
];
const PERSISTENT_FIELDS = [
  'returnStatus', 'refundAmount', 'inspectionResult', 'processingNotes'
];
```

### **Customer Service & Support**

#### **Support Tickets**
```typescript
const INPUT_FIELDS = [
  'ticketSubject', 'issueCategory', 'priorityLevel', 'customerMessage'
];
const PERSISTENT_FIELDS = [
  'assignedAgent', 'ticketStatus', 'estimatedResolution', 'internalNotes'
];
```

#### **Bug Reports**
```typescript
const INPUT_FIELDS = [
  'bugTitle', 'bugDescription', 'stepsToReproduce', 'expectedBehavior', 'browserInfo'
];
const PERSISTENT_FIELDS = [
  'bugStatus', 'assignedDeveloper', 'bugPriority', 'resolutionNotes'
];
```

### **Content Management**

#### **Article Publishing**
```typescript
const INPUT_FIELDS = [
  'contentTitle', 'contentType', 'publishDate', 'contentBody', 'authorName'
];
const PERSISTENT_FIELDS = [
  'contentStatus', 'reviewerNotes', 'seoScore', 'publishedUrl'
];
```

#### **Media Processing**
```typescript
const INPUT_FIELDS = [
  'mediaTitle', 'mediaType', 'mediaUrl', 'mediaDescription', 'tags'
];
const PERSISTENT_FIELDS = [
  'processingStatus', 'optimizedUrl', 'mediaSize', 'compressionNotes'
];
```

### **CRM & Sales**

#### **Lead Management**
```typescript
const INPUT_FIELDS = [
  'leadName', 'leadEmail', 'leadPhone', 'leadSource', 'interestLevel'
];
const PERSISTENT_FIELDS = [
  'leadScore', 'assignedSalesRep', 'salesStage', 'followUpDate', 'salesNotes'
];
```

#### **Quote Generation**
```typescript
const INPUT_FIELDS = [
  'clientName', 'clientEmail', 'projectDescription', 'projectBudget', 'timeline'
];
const PERSISTENT_FIELDS = [
  'quoteStatus', 'quoteAmount', 'quoteDocument', 'approvalDate', 'quoteNotes'
];
```

### **Financial Services**

#### **Loan Applications**
```typescript
const INPUT_FIELDS = [
  'applicantName', 'applicantSSN', 'loanAmount', 'loanPurpose', 'annualIncome'
];
const PERSISTENT_FIELDS = [
  'creditScore', 'applicationStatus', 'approvalAmount', 'interestRate', 'underwriterNotes'
];
```

#### **Invoice Processing**
```typescript
const INPUT_FIELDS = [
  'vendorName', 'invoiceNumber', 'invoiceAmount', 'invoiceDate', 'approvalManager'
];
const PERSISTENT_FIELDS = [
  'paymentStatus', 'approvalDate', 'paymentDate', 'financeNotes'
];
```

### **Human Resources**

#### **Job Applications**
```typescript
const INPUT_FIELDS = [
  'applicantName', 'applicantEmail', 'positionApplied', 'resumeUrl', 'coverLetter'
];
const PERSISTENT_FIELDS = [
  'applicationStatus', 'skillsMatch', 'interviewDate', 'hrNotes'
];
```

#### **Employee Onboarding**
```typescript
const INPUT_FIELDS = [
  'employeeName', 'employeeEmail', 'startDate', 'department', 'jobTitle'
];
const PERSISTENT_FIELDS = [
  'onboardingStatus', 'equipmentAssigned', 'trainingSchedule', 'managerNotes'
];
```

### **Healthcare & Medical**

#### **Patient Intake**
```typescript
const INPUT_FIELDS = [
  'patientName', 'patientAge', 'symptoms', 'medicalHistory', 'insuranceInfo'
];
const PERSISTENT_FIELDS = [
  'triageLevel', 'assignedDoctor', 'appointmentTime', 'medicalNotes'
];
```

#### **Lab Results**
```typescript
const INPUT_FIELDS = [
  'patientId', 'testType', 'testDate', 'labTechnician'
];
const PERSISTENT_FIELDS = [
  'testResults', 'resultStatus', 'doctorReview', 'followUpRequired'
];
```

## 🔄 **N8N Integration Patterns**

### **Standard Payload Structure**
Your N8N workflow always receives:
```json
{
  "user_id": "supabase-user-uuid",
  "user_email": "user@example.com",
  "data": {
    "inputField1": "value1",
    "inputField2": "value2",
    "inputField3": "value3"
  },
  "action": "process"
}
```

### **Standard N8N Workflow Template**
```javascript
// 1. Webhook Trigger (POST /webhook/your-endpoint)
// 2. Validate Secret
if (headers['x-webhook-secret'] !== 'your-secret') {
  return { error: 'Unauthorized' };
}

// 3. Extract Data
const { user_id, data } = $json;
const { fieldName1, fieldName2 } = data;

// 4. Process Logic (your custom business logic here)
let result1 = processField1(fieldName1);
let result2 = processField2(fieldName2);

// 5. Update Database (your database update logic)
await updateDatabase(user_id, { 
  persistentField1: result1,
  persistentField2: result2 
});

// 6. Return Response
return {
  user_id,
  updatedFields: ['persistentField1', 'persistentField2']
};
```

### **Required N8N Response**
Your workflow must send this webhook back:
```json
{
  "user_id": "same-user-uuid",
  "updatedFields": ["persistentField1", "persistentField2"]
}
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

## 🎯 **Customization Patterns**

### **Field Labels & Validation**
```typescript
// Customize field labels in the UI
const getFieldLabel = (fieldName: string) => {
  const labels = {
    customerEmail: 'Customer Email Address',
    productSku: 'Product SKU',
    orderQuantity: 'Order Quantity',
    // Add your custom labels
  };
  return labels[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
};

// Add custom validation
const validateField = (fieldName: string, value: string) => {
  if (fieldName === 'customerEmail' && !value.includes('@')) {
    return 'Please enter a valid email address';
  }
  return null;
};
```

### **Business Logic Customization**
```typescript
// Add custom business logic
const handleSendToN8n = () => {
  // Add pre-processing validation
  if (inputData.orderQuantity && parseInt(inputData.orderQuantity) > 100) {
    toast.error("Large orders require manager approval");
    return;
  }
  
  // Add data transformation
  const processedData = {
    ...inputData,
    orderQuantity: parseInt(inputData.orderQuantity),
    orderTotal: calculateTotal(inputData)
  };
  
  sendToN8n(processedData);
};
```

## 🚀 **Real-Time Updates**

The template automatically handles real-time updates when N8N completes processing:

1. **N8N processes your data** (black box)
2. **N8N updates database** with results
3. **N8N sends webhook** with `updatedFields` array
4. **UI automatically refreshes** and highlights updated fields
5. **User sees results** in real-time

## 🛠️ **Troubleshooting**

### **Common Issues**
- **Fields not displaying**: Check field names in `INPUT_FIELDS` array
- **Database errors**: Ensure all `PERSISTENT_FIELDS` have database columns
- **N8N connection failed**: Verify `N8N_BASE_URL` and `N8N_WEBHOOK_SECRET`
- **No real-time updates**: Check N8N webhook returns correct response format

### **Debug Commands**
```bash
# Test database connection
npm run dev
# Visit /n8n-demo and click "Test Connection"

# Check database columns
# Visit /n8n-demo and click "Show Debug Info"

# Verify N8N payload format
# Check browser network tab when sending to N8N
```

## ✅ **Success Validation**

Your template adaptation is successful when:
- [ ] Form displays all INPUT_FIELDS correctly
- [ ] Database stores all PERSISTENT_FIELDS properly
- [ ] N8N receives standardized payload structure
- [ ] N8N returns standardized response format
- [ ] Real-time updates highlight changed fields
- [ ] User can edit and save editable persistent fields

## 📊 **Performance Optimization**

### **Production Readiness**
- [ ] Add error boundaries for robust error handling
- [ ] Implement retry logic for N8N failures
- [ ] Add comprehensive logging for debugging
- [ ] Create automated tests for your field configuration
- [ ] Add monitoring for N8N integration health

### **Optional Enhancements**
- [ ] Add field validation to prevent invalid submissions
- [ ] Implement debounced auto-save for editable fields
- [ ] Add loading states for better UX
- [ ] Create field grouping for complex forms
- [ ] Add keyboard shortcuts for common actions

---

**⚡ Total Setup Time: 5 minutes for basic adaptation, 10 minutes for full customization**

**🚀 Ready to start?** Pick your use case from the field configuration library above, follow the 5-minute setup process, and you'll have a working N8N integration in minutes! 