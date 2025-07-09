# N8N Template Rapid Adaptation Checklist

## ⚡ **5-Minute Setup Process**

### **Step 1: Pick Your Use Case** (30 seconds)
- [ ] Review the [Field Configuration Library](n8n-quick-reference.md#field-configuration-library)
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

## 🎯 **Customization Checkpoints**

### **UI Customization (Optional)**
- [ ] Update page title in the header section
- [ ] Customize field labels using the `getFieldLabel` pattern
- [ ] Add field-specific validation rules
- [ ] Style form fields for your use case
- [ ] Update button text and descriptions

### **Business Logic Customization (Optional)**
- [ ] Add pre-processing validation in `handleSendToN8n`
- [ ] Implement field-specific formatting
- [ ] Add conditional logic based on field values
- [ ] Create custom error messages for your use case

### **Advanced Customization (Optional)**
- [ ] Add multi-step form logic
- [ ] Implement field dependencies
- [ ] Add custom success/error handling
- [ ] Create field grouping and sections

## 📋 **Common Use Case Adaptations**

### **E-commerce Order Processing**
```typescript
// 1. Update field arrays
const INPUT_FIELDS = ['customerEmail', 'productSku', 'orderQuantity'];
const PERSISTENT_FIELDS = ['orderStatus', 'trackingNumber', 'customerNotes'];

// 2. Add database columns
// node scripts/add-field.js orderStatus
// node scripts/add-field.js trackingNumber
// node scripts/add-field.js customerNotes

// 3. Update N8N endpoint
// /webhook/process-order
```

### **Support Ticket System**
```typescript
// 1. Update field arrays
const INPUT_FIELDS = ['ticketSubject', 'issueCategory', 'customerMessage'];
const PERSISTENT_FIELDS = ['assignedAgent', 'ticketStatus', 'internalNotes'];

// 2. Add database columns
// node scripts/add-field.js assignedAgent
// node scripts/add-field.js ticketStatus
// node scripts/add-field.js internalNotes

// 3. Update N8N endpoint
// /webhook/process-ticket
```

### **Content Management**
```typescript
// 1. Update field arrays
const INPUT_FIELDS = ['articleTitle', 'contentType', 'authorName'];
const PERSISTENT_FIELDS = ['contentStatus', 'reviewerNotes', 'editorComments'];

// 2. Add database columns
// node scripts/add-field.js contentStatus
// node scripts/add-field.js reviewerNotes
// node scripts/add-field.js editorComments

// 3. Update N8N endpoint
// /webhook/process-content
```

## 🛠️ **Troubleshooting Quick Fixes**

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

## 🚀 **Performance Optimization**

### **Optional Enhancements**
- [ ] Add field validation to prevent invalid submissions
- [ ] Implement debounced auto-save for editable fields
- [ ] Add loading states for better UX
- [ ] Create field grouping for complex forms
- [ ] Add keyboard shortcuts for common actions

### **Production Readiness**
- [ ] Add error boundaries for robust error handling
- [ ] Implement retry logic for N8N failures
- [ ] Add comprehensive logging for debugging
- [ ] Create automated tests for your field configuration
- [ ] Add monitoring for N8N integration health

---

**⚡ Total Setup Time: 5 minutes for basic adaptation, 10 minutes for full customization**

**💡 Pro Tip**: Start with the closest use case from the library, then customize incrementally. The template is designed for rapid iteration and testing! 