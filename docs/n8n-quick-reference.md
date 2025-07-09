# N8N Quick Reference - Field Configuration Lookup

## 🚀 **Template Adaptation Checklist**

### **Quick Start (5 minutes)**
1. Pick a use case from the library below
2. Copy the field arrays to your component
3. Run database field addition commands
4. Update N8N workflow endpoint
5. Test with the provided payload examples

### **Essential Files to Copy**
```bash
# Core template components
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-page/page.tsx

# Update field arrays in your-page/client-page.tsx
```

### **Essential Environment Variables**
```bash
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-webhook-secret-min-32-chars"
N8N_TIMEOUT=30000
```

## 📋 **Field Configuration Library**

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
  'bugTitle', 'bugDescription', 'severityLevel', 'stepsToReproduce', 'browserInfo'
];
const PERSISTENT_FIELDS = [
  'bugStatus', 'assignedDeveloper', 'fixEstimate', 'testingNotes'
];
```

#### **Feature Requests**
```typescript
const INPUT_FIELDS = [
  'featureTitle', 'featureDescription', 'businessJustification', 'requestorRole'
];
const PERSISTENT_FIELDS = [
  'requestStatus', 'developmentPriority', 'implementationDate', 'productNotes'
];
```

### **Content Management**

#### **Blog Publishing**
```typescript
const INPUT_FIELDS = [
  'articleTitle', 'articleBody', 'authorName', 'publishDate', 'categoryTags'
];
const PERSISTENT_FIELDS = [
  'contentStatus', 'seoScore', 'reviewerNotes', 'editorComments'
];
```

#### **Social Media**
```typescript
const INPUT_FIELDS = [
  'postContent', 'platformType', 'scheduledTime', 'targetAudience'
];
const PERSISTENT_FIELDS = [
  'postStatus', 'engagementScore', 'moderationNotes', 'campaignNotes'
];
```

#### **Document Review**
```typescript
const INPUT_FIELDS = [
  'documentTitle', 'documentType', 'submissionDate', 'authorDepartment'
];
const PERSISTENT_FIELDS = [
  'reviewStatus', 'approvalLevel', 'reviewerFeedback', 'complianceNotes'
];
```

### **CRM & Sales**

#### **Lead Qualification**
```typescript
const INPUT_FIELDS = [
  'leadName', 'leadEmail', 'leadPhone', 'leadSource', 'leadInterest'
];
const PERSISTENT_FIELDS = [
  'leadScore', 'assignedSales', 'nextAction', 'salesNotes'
];
```

#### **Deal Management**
```typescript
const INPUT_FIELDS = [
  'dealName', 'dealValue', 'clientName', 'dealStage', 'expectedCloseDate'
];
const PERSISTENT_FIELDS = [
  'dealStatus', 'winProbability', 'competitorAnalysis', 'accountNotes'
];
```

#### **Customer Onboarding**
```typescript
const INPUT_FIELDS = [
  'customerName', 'customerEmail', 'packageType', 'implementationDate'
];
const PERSISTENT_FIELDS = [
  'onboardingStatus', 'assignedManager', 'completionDate', 'clientNotes'
];
```

### **Financial & Accounting**

#### **Expense Processing**
```typescript
const INPUT_FIELDS = [
  'expenseAmount', 'expenseCategory', 'expenseDate', 'merchantName', 'employeeId'
];
const PERSISTENT_FIELDS = [
  'approvalStatus', 'processingDate', 'reimbursementAmount', 'accountingNotes'
];
```

#### **Invoice Processing**
```typescript
const INPUT_FIELDS = [
  'invoiceNumber', 'vendorName', 'invoiceAmount', 'invoiceDate', 'paymentTerms'
];
const PERSISTENT_FIELDS = [
  'paymentStatus', 'approvalDate', 'paymentDate', 'financeNotes'
];
```

#### **Transaction Monitoring**
```typescript
const INPUT_FIELDS = [
  'transactionId', 'transactionAmount', 'transactionType', 'merchantId', 'customerId'
];
const PERSISTENT_FIELDS = [
  'riskScore', 'transactionStatus', 'complianceNotes', 'reviewNotes'
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

#### **Performance Reviews**
```typescript
const INPUT_FIELDS = [
  'employeeId', 'reviewPeriod', 'selfAssessment', 'goalAchievements'
];
const PERSISTENT_FIELDS = [
  'reviewStatus', 'performanceRating', 'developmentPlan', 'supervisorNotes'
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

### **Education & Training**

#### **Course Enrollment**
```typescript
const INPUT_FIELDS = [
  'studentName', 'studentEmail', 'courseTitle', 'enrollmentDate', 'paymentStatus'
];
const PERSISTENT_FIELDS = [
  'enrollmentStatus', 'classSchedule', 'instructorAssigned', 'adminNotes'
];
```

#### **Assignment Grading**
```typescript
const INPUT_FIELDS = [
  'studentId', 'assignmentTitle', 'submissionDate', 'submissionFile'
];
const PERSISTENT_FIELDS = [
  'grade', 'gradingStatus', 'feedback', 'instructorNotes'
];
```

## 🔧 **Standard N8N Workflow Patterns**

### **Basic N8N Workflow Template**
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

### **Standard Payload Structure**
```json
{
  "user_id": "supabase-user-uuid",
  "user_email": "user@example.com",
  "data": {
    "inputField1": "value1",
    "inputField2": "value2"
  },
  "action": "process"
}
```

### **Standard Response Structure**
```json
{
  "user_id": "same-user-uuid",
  "updatedFields": ["persistentField1", "persistentField2"]
}
```

## 🎯 **Template Customization Patterns**

### **Field Type Validation**
```typescript
// Input validation patterns
const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validatePhone = (value: string) => /^\d{10}$/.test(value);
const validateDate = (value: string) => !isNaN(Date.parse(value));
```

### **UI Customization**
```typescript
// Field label customization
const getFieldLabel = (fieldName: string) => {
  const labels = {
    customerEmail: 'Customer Email Address',
    productSku: 'Product SKU',
    orderQuantity: 'Order Quantity',
    // Add your custom labels
  };
  return labels[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
};
```

### **Business Logic Patterns**
```typescript
// Conditional processing
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

## 🚀 **Ready to Start?**

1. **Pick your use case** from the library above
2. **Copy the field arrays** to your component
3. **Run the database commands** to add columns
4. **Update your N8N workflow** to handle the fields
5. **Test with the payload examples**

**Total setup time: 5 minutes** ⚡

---

**Need help?** All patterns follow the same template structure - just replace the field arrays with your use case and you're ready to go! 