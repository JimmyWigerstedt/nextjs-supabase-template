# AI Assistant Template Guide: Building Custom Pages with N8N Integration

## 🎯 **Template Philosophy**

This template provides **reusable patterns** for building custom data management pages with N8N integration. The goal is to teach you **how to think about building your own solutions** using these patterns as building blocks.

**Key Principle:** Replace field names with your use case, keep the patterns identical.

## 📋 **Quick Start Template**

### Step 1: Define Your Fields
```typescript
// Replace these with your actual field names
const DEVELOPMENT_FIELDS = [
  'customerName',      // Replace with your field 1
  'orderStatus',       // Replace with your field 2  
  'productCategory',   // Replace with your field 3
  // Add as many as needed for your use case
];
```

### Step 2: Add Database Fields
```bash
# Add each field to your database
npm run add-field customerName
npm run add-field orderStatus  
npm run add-field productCategory
```

### Step 3: Copy Component Template
```typescript
// Copy this exact structure - only change the field names
"use client";
import { useState, useEffect, useRef } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";

// 🎯 CUSTOMIZE THIS: Replace with your field names
const DEVELOPMENT_FIELDS = [
  'customerName',
  'orderStatus', 
  'productCategory'
];

export function YourCustomPageClient() {
  // 🔒 NEVER CHANGE: Required state structure
  const utils = clientApi.useUtils();
  const [fieldInputs, setFieldInputs] = useState<Record<string, string>>(
    DEVELOPMENT_FIELDS.reduce((acc, field) => {
      acc[field] = "";
      return acc;
    }, {} as Record<string, string>)
  );
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [highlightedFields] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  // 🔒 NEVER CHANGE: Required helper functions
  const updateFieldInput = (fieldName: string, value: string) => {
    setFieldInputs(prev => ({ ...prev, [fieldName]: value }));
  };

  const getFieldHighlight = (fieldName: string) => {
    return highlightedFields.has(fieldName) 
      ? "bg-green-100 border-green-300 transition-colors duration-300" 
      : "";
  };

  // 🔒 NEVER CHANGE: Required tRPC setup
  const { data: userData, refetch: refetchUserData, isLoading: isLoadingData } = 
    clientApi.internal.getUserData.useQuery();

  const { mutate: updateUserData, isPending: isUpdating } = 
    clientApi.internal.updateUserData.useMutation({
      onSuccess: () => {
        toast.success("Data updated successfully!");
        void refetchUserData();
        setFieldInputs(prev => 
          Object.keys(prev).reduce((acc, key) => {
            acc[key] = "";
            return acc;
          }, {} as Record<string, string>)
        );
      },
      onError: (error) => {
        toast.error(`Error: ${error.message}`);
      },
    });

  const { mutate: sendToN8n, isPending: isSendingToN8n } = 
    clientApi.internal.sendToN8n.useMutation({
      onSuccess: () => {
        toast.success("Sent to n8n successfully!");
        setFieldInputs(prev => 
          Object.keys(prev).reduce((acc, key) => {
            acc[key] = "";
            return acc;
          }, {} as Record<string, string>)
        );
      },
      onError: (error) => {
        toast.error(`n8n error: ${error.message}`);
      },
    });

  // 🔒 NEVER CHANGE: Required SSE setup
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/user-updates");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "userData-updated") {
          setLastUpdate(data.timestamp ?? new Date().toISOString());
          void utils.internal.getUserData.invalidate();
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };
    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []); // Empty dependency array - SSE connection should only be created once

  // 🔒 NEVER CHANGE: Required handlers
  const handleUpdateData = () => {
    const updates: Record<string, string> = {};
    Object.entries(fieldInputs).forEach(([fieldName, value]) => {
      if (value.trim()) {
        updates[fieldName] = value.trim();
      }
    });
    if (Object.keys(updates).length === 0) {
      toast.error("Please enter at least one field to update");
      return;
    }
    updateUserData(updates);
  };

  const handleSendToN8n = () => {
    const dataToSend: Record<string, string> = {};
    Object.entries(fieldInputs).forEach(([fieldName, value]) => {
      if (value.trim()) {
        dataToSend[fieldName] = value.trim();
      }
    });
    if (Object.keys(dataToSend).length === 0) {
      toast.error("Please enter some data to send to n8n");
      return;
    }
    sendToN8n(dataToSend);
  };

  // 🎯 CUSTOMIZE THIS: Your UI layout and styling
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* 🎯 CUSTOMIZE: Page title */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your Custom Page Title
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Live Updates Connected' : 'Disconnected'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* 🔒 NEVER CHANGE: Dynamic form generation */}
        <Card>
          <CardHeader>
            <CardTitle>Data Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(fieldInputs).map((fieldName) => (
              <div key={fieldName}>
                <Label htmlFor={`${fieldName}-input`}>
                  {/* 🎯 CUSTOMIZE: Field display names */}
                  {fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Label>
                <Input
                  id={`${fieldName}-input`}
                  value={fieldInputs[fieldName] ?? ""}
                  onChange={(e) => updateFieldInput(fieldName, e.target.value)}
                  disabled={isUpdating}
                />
              </div>
            ))}
            <Button onClick={handleUpdateData} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Data"}
            </Button>
          </CardContent>
        </Card>

        {/* 🔒 NEVER CHANGE: Dynamic value display */}
        <Card>
          <CardHeader>
            <CardTitle>Current Values</CardTitle>
          </CardHeader>
          <CardContent>
            {userData && Object.entries(userData)
              .filter(([key]) => !['UID', 'created_at', 'updated_at'].includes(key))
              .map(([fieldName, value]) => (
                <div key={fieldName} className="mb-2">
                  <Label>{fieldName} (Current Value)</Label>
                  <div className={getFieldHighlight(fieldName)}>
                    {String(value) || "(empty)"}
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>

        {/* 🔒 NEVER CHANGE: N8N integration */}
        <Card>
          <CardHeader>
            <CardTitle>Send to N8N</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSendToN8n} disabled={isSendingToN8n}>
              {isSendingToN8n ? "Sending..." : "Send to N8N"}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
```

## 🎯 **Use Case Templates**

### E-commerce Order Management
```typescript
const DEVELOPMENT_FIELDS = [
  'customerEmail',
  'productSku', 
  'orderQuantity',
  'shippingAddress',
  'paymentStatus'
];

// Your N8N workflow receives:
{
  "data": {
    "customerEmail": "customer@example.com",
    "productSku": "PROD-123",
    "orderQuantity": "2",
    "shippingAddress": "123 Main St",
    "paymentStatus": "pending"
  }
}
```

### Customer Support Tickets
```typescript
const DEVELOPMENT_FIELDS = [
  'ticketSubject',
  'issueCategory',
  'priorityLevel',
  'customerMessage',
  'assignedAgent'
];

// Your N8N workflow receives:
{
  "data": {
    "ticketSubject": "Login Issues",
    "issueCategory": "technical",
    "priorityLevel": "high",
    "customerMessage": "Cannot access account",
    "assignedAgent": "support-team"
  }
}
```

### Content Management
```typescript
const DEVELOPMENT_FIELDS = [
  'contentTitle',
  'contentType',
  'publishDate',
  'authorName',
  'contentStatus'
];

// Your N8N workflow receives:
{
  "data": {
    "contentTitle": "New Blog Post",
    "contentType": "blog",
    "publishDate": "2024-01-15",
    "authorName": "John Doe",
    "contentStatus": "draft"
  }
}
```

### CRM Lead Management
```typescript
const DEVELOPMENT_FIELDS = [
  'leadSource',
  'companyName',
  'contactEmail',
  'leadScore',
  'salesStage'
];

// Your N8N workflow receives:
{
  "data": {
    "leadSource": "website",
    "companyName": "Acme Corp",
    "contactEmail": "contact@acme.com",
    "leadScore": "85",
    "salesStage": "qualified"
  }
}
```

## 🔄 **N8N Workflow Pattern**

Your N8N workflow always receives this structure:
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

### Accessing Field Values in N8N
```javascript
// Access any field using:
{{ $json.data.yourField1 }}
{{ $json.data.yourField2 }}
{{ $json.data.yourField3 }}

// User information:
{{ $json.user_id }}
{{ $json.user_email }}
```

### N8N Response Pattern
Your workflow must send this webhook back:
```json
{
  "user_id": "same-user-uuid",
  "updatedFields": ["yourField1", "yourField2"]
}
```

## 🎨 **Customization Guidelines**

### ✅ **Safe to Customize**
- **Field names** in `DEVELOPMENT_FIELDS` array
- **Page titles** and descriptions
- **UI layout** and styling
- **Field display names** and formatting
- **Validation rules** and error messages
- **Card organization** and grouping

### ❌ **Never Change**
- **State management** structure
- **tRPC mutation** setup and handlers
- **SSE connection** logic
- **Helper functions** (`updateFieldInput`, `getFieldHighlight`)
- **Event handlers** (`handleUpdateData`, `handleSendToN8n`)
- **Dynamic rendering** patterns

## 🚀 **Advanced Patterns**

### Field Grouping
```typescript
const CONTACT_FIELDS = ['firstName', 'lastName', 'email'];
const ADDRESS_FIELDS = ['street', 'city', 'zipCode'];
const ORDER_FIELDS = ['productName', 'quantity', 'price'];

const DEVELOPMENT_FIELDS = [
  ...CONTACT_FIELDS,
  ...ADDRESS_FIELDS, 
  ...ORDER_FIELDS
];
```

### Field Validation
```typescript
const validateField = (fieldName: string, value: string): string | null => {
  switch (fieldName) {
    case 'email':
      return /\S+@\S+\.\S+/.test(value) ? null : 'Invalid email';
    case 'phone':
      return /^\d{10}$/.test(value) ? null : 'Invalid phone number';
    case 'price':
      return !isNaN(Number(value)) ? null : 'Must be a number';
    default:
      return null;
  }
};
```

### Custom Field Formatting
```typescript
const formatFieldDisplay = (fieldName: string, value: string): string => {
  switch (fieldName) {
    case 'customerEmail':
      return value.toLowerCase();
    case 'productPrice':
      return `$${parseFloat(value).toFixed(2)}`;
    case 'orderDate':
      return new Date(value).toLocaleDateString();
    default:
      return value;
  }
};
```

### Conditional Field Display
```typescript
const shouldShowField = (fieldName: string): boolean => {
  // Hide billing address if same as shipping
  if (fieldName === 'billingAddress' && fieldInputs['sameAsShipping'] === 'true') {
    return false;
  }
  
  // Show advanced fields only for premium users
  if (['advancedOption1', 'advancedOption2'].includes(fieldName)) {
    return userData?.userType === 'premium';
  }
  
  return true;
};
```

## 🔧 **Development Workflow**

### 1. Plan Your Fields
```typescript
// Think about your use case first
const DEVELOPMENT_FIELDS = [
  'field1',  // What data do you need?
  'field2',  // What will N8N process?
  'field3',  // What will be updated?
];
```

### 2. Add to Database
```bash
npm run add-field field1
npm run add-field field2
npm run add-field field3
```

### 3. Copy Template
- Copy component structure exactly
- Update `DEVELOPMENT_FIELDS` array
- Customize UI sections only

### 4. Build N8N Workflow
- Create webhook endpoint
- Process `{{ $json.data.field1 }}` etc.
- Send webhook back with `updatedFields`

### 5. Test Integration
- Save data directly to database
- Send data to N8N
- Verify real-time updates

## 🎯 **Success Metrics**

With this template approach, you should be able to:
- ✅ **Create new pages** in under 10 minutes
- ✅ **Add new fields** without backend changes
- ✅ **Integrate with N8N** using standard patterns
- ✅ **Maintain type safety** across the full stack
- ✅ **Get real-time updates** automatically

## 📚 **Next Steps**

1. **Study the patterns** in this guide
2. **Choose your use case** and define fields
3. **Follow the template** exactly
4. **Customize the UI** to match your needs
5. **Build your N8N workflow** using the patterns
6. **Test the integration** end-to-end

This template philosophy enables rapid development while maintaining consistency and reliability across your entire application. 