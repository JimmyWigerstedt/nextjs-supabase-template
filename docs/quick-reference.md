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

// PERSISTENT_FIELDS: Database columns for storage and real-time updates
const PERSISTENT_FIELDS = [
  'orderStatus',      // Database column → display/edit → real-time updates
  'trackingNumber',   // Database column → display/edit → real-time updates
  'customerNotes'     // Database column → display/edit → real-time updates
];
```

### 3. **Add Database Columns**
```bash
# Add PERSISTENT_FIELDS to database (INPUT_FIELDS don't need columns)
npm run add-field orderStatus
npm run add-field trackingNumber
npm run add-field customerNotes
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
  "data": {
    "customerEmail": "value",
    "productSku": "value",
    "orderQuantity": "value"
  },
  "action": "process"
}
```

Your workflow should send back:
```json
{
  "user_id": "uuid", 
  "updatedFields": ["orderStatus", "trackingNumber"]
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
- `PERSISTENT_FIELDS` array
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
  
  sendToN8n(processedData);
};
```

## 📊 **Database Field Management**

### **Valid Field Names**
- ✅ `customerName`, `order_status`, `shipment123`
- ❌ `customer-name`, `order status`, `123order`

### **Reserved Field Names**
- `UID` (user identifier)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### **Field Type Mapping**
```typescript
// Database column types
const fieldTypes = {
  'email': 'VARCHAR(255)',
  'phone': 'VARCHAR(20)',
  'date': 'DATE',
  'number': 'INTEGER',
  'text': 'TEXT',
  'boolean': 'BOOLEAN'
};
```

## 🔍 **Debug Commands**

### **Database Connection**
```bash
# Test database connection
npm run dev
# Visit /n8n-demo and click "Test Connection"
```

### **Field Verification**
```bash
# Check database columns
# Visit /n8n-demo and click "Show Debug Info"
```

### **N8N Payload Testing**
```bash
# Check browser network tab when sending to N8N
# Look for POST requests to /api/trpc/internal.sendToN8n
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
- [ ] All PERSISTENT_FIELDS save to database
- [ ] N8N receives correct payload format
- [ ] N8N returns correct response format
- [ ] Real-time updates work
- [ ] Error handling works
- [ ] Field validation works

---

**🔗 For detailed field configuration examples, see the [Complete Template Guide](./complete-template-guide.md)** 