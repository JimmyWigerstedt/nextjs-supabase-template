# AI Coder Quick Reference

## Template Adaptation Checklist

### 1. Copy Template Component
```bash
# Copy from existing template
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-page/page.tsx
```

### 2. Configure Field Arrays
```typescript
// Replace with your field names
const INPUT_FIELDS = [
  'customerEmail',    // Form input → N8N payload → cleared
  'productSku',       // Form input → N8N payload → cleared  
  'orderQuantity'     // Form input → N8N payload → cleared
];

const PERSISTENT_FIELDS = [
  'orderStatus',      // Database column → display/edit → real-time updates
  'trackingNumber',   // Database column → display/edit → real-time updates
  'customerNotes'     // Database column → display/edit → real-time updates
];
```

### 3. Update Component Details
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

## Field Configuration Patterns

### E-commerce Order Processing
```typescript
const INPUT_FIELDS = ['customerEmail', 'productSku', 'orderQuantity', 'shippingAddress'];
const PERSISTENT_FIELDS = ['orderStatus', 'trackingNumber', 'estimatedDelivery'];
```

### Customer Support System
```typescript
const INPUT_FIELDS = ['ticketSubject', 'issueCategory', 'priorityLevel', 'customerMessage'];
const PERSISTENT_FIELDS = ['assignedAgent', 'ticketStatus', 'resolutionNotes'];
```

### Content Management
```typescript
const INPUT_FIELDS = ['contentTitle', 'contentType', 'publishDate', 'contentBody'];
const PERSISTENT_FIELDS = ['contentStatus', 'seoScore', 'editorComments'];
```

### CRM Lead Management
```typescript
const INPUT_FIELDS = ['leadName', 'leadEmail', 'leadSource', 'leadInterest'];
const PERSISTENT_FIELDS = ['leadScore', 'assignedSales', 'nextAction'];
```

## Component Customization Rules

### ✅ ALWAYS CUSTOMIZE
- `INPUT_FIELDS` and `PERSISTENT_FIELDS` arrays
- Component name and page title
- Field labels and validation logic
- UI layout and styling

### ❌ NEVER MODIFY
- Import statements
- State management structure
- tRPC mutation patterns
- SSE connection logic
- Helper functions (`updateInputField`, `getFieldHighlight`)
- Button handlers (`handleSendToN8n`, `handleSaveField`)

## API Contract Formats

### N8N Payload (Template → N8N)
```json
{
  "user_id": "supabase-user-uuid",
  "user_email": "user@example.com",
  "data": {
    "fieldName1": "value1",
    "fieldName2": "value2"
  },
  "action": "process"
}
```

### N8N Response (N8N → Template)
```json
{
  "user_id": "same-user-uuid",
  "updatedFields": ["fieldName1", "fieldName2"]
}
```

### SSE Update Format
```json
{
  "type": "userData-updated",
  "updatedFields": ["fieldName1"],
  "fetchedValues": {"fieldName1": "new-value"},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Common Validation Patterns

### Field Validation
```typescript
const validateField = (fieldName: string, value: string): string | null => {
  switch (fieldName) {
    case 'customerEmail':
      return /\S+@\S+\.\S+/.test(value) ? null : 'Invalid email format';
    case 'orderQuantity':
      return !isNaN(Number(value)) && Number(value) > 0 ? null : 'Must be positive number';
    default:
      return null;
  }
};
```

### Field Grouping
```typescript
const fieldGroups = {
  customer: ['customerEmail', 'customerName'],
  order: ['productSku', 'orderQuantity', 'orderStatus'],
  fulfillment: ['trackingNumber', 'shippingAddress']
};
```

## Field Naming Rules

### ✅ Valid Names
- `customerName` (camelCase)
- `order_status` (snake_case)
- `shipment123` (alphanumeric)

### ❌ Invalid Names
- `customer-name` (hyphens)
- `order status` (spaces)
- `123order` (starts with number)

## Trust Developer Setup

**Database Fields**: Trust that developer has added PERSISTENT_FIELDS to database using `npm run add-field fieldName`

**N8N Workflows**: Trust that developer has configured N8N to receive your payload format and return the expected response format

**Environment**: Trust that developer has configured all required environment variables

Your responsibility is template adaptation, not infrastructure setup. 