# Quick Reference for AI Assistants

## New Page Checklist

### 1. Database Setup
```bash
# Add your fields
npm run add-field customerName
npm run add-field orderStatus
npm run add-field orderTotal
```

### 2. Component Creation
```bash
# Create page directory
mkdir src/app/your-new-page

# Copy from template (use n8n-demo as reference)
cp src/app/n8n-demo/client-page.tsx src/app/your-new-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-new-page/page.tsx
```

### 3. Customize Component
```typescript
// In client-page.tsx - ONLY change these:

// 1. Component name
export function YourNewPageClient() {

// 2. Field list  
const DEVELOPMENT_FIELDS = [
  'customerName',
  'orderStatus', 
  'orderTotal'
];

// 3. Page title
<CardTitle>Your Page Title</CardTitle>

// 4. Optional: Custom formatting functions
const formatFieldName = (fieldName: string) => {
  // Your custom logic
};
```

### 4. n8n Workflow Setup

Your workflow receives:
```json
{
  "user_id": "uuid",
  "user_email": "email@example.com",
  "data": {
    "customerName": "value",
    "orderStatus": "value"
  },
  "action": "process"
}
```

Your workflow should send back:
```json
{
  "user_id": "uuid", 
  "updatedFields": ["customerName", "orderStatus"]
}
```

## File Structure

```
src/app/your-new-page/
├── page.tsx           # Server component (copy exactly)
└── client-page.tsx    # Main component (customize this)
```

## What to Copy vs Customize

### Copy Exactly (Never Modify)
- All import statements
- All state declarations  
- All tRPC mutation setup
- SSE connection logic
- Helper functions (updateFieldInput, getFieldHighlight, etc.)
- Button click handlers (handleUpdateData, handleSendToN8n)

### Customize These
- `DEVELOPMENT_FIELDS` array
- Component name
- Page title and descriptions
- Field formatting functions
- UI layout and styling
- Card organization

## Common Patterns

### Field Validation
```typescript
const validateField = (fieldName: string, value: string): string | null => {
  switch (fieldName) {
    case 'email':
      return /\S+@\S+\.\S+/.test(value) ? null : 'Invalid email';
    case 'amount':
      return !isNaN(Number(value)) ? null : 'Must be a number';
    default:
      return null;
  }
};
```

### Field Grouping
```typescript
const fieldGroups = {
  personal: ['firstName', 'lastName', 'email'],
  order: ['orderDate', 'orderTotal', 'orderStatus']
};
```

### Conditional Display
```typescript
const shouldShowField = (fieldName: string): boolean => {
  if (fieldName === 'billingAddress' && fieldInputs['sameAsShipping'] === 'true') {
    return false;
  }
  return true;
};
```

## Debugging

### Check SSE Connection
Look for browser console messages:
- "SSE connection opened" = ✅ Connected
- "SSE error" = ❌ Connection failed

### Test Webhook Flow
1. Send data to n8n
2. Check n8n workflow logs
3. Verify webhook is sent to `/api/webhooks/internal-updated`
4. Look for green field highlighting in UI

### Database Issues
```bash
# Check database structure
npm run db:studio

# Test connection
# Use the "Test DB Connection" button in your page
```

## Field Naming Rules

✅ **Valid field names:**
- `customerName`
- `order_status`
- `shipment123`

❌ **Invalid field names:**
- `customer-name` (hyphens)
- `order status` (spaces)
- `123order` (starts with number)

## Environment Variables Required

```bash
# Internal database for dynamic fields
INTERNAL_DATABASE_URL="postgresql://..."

# n8n integration
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-webhook-secret"
```

## Copy-Paste Templates

### Minimal Page Component
```typescript
"use client";
import { useState, useEffect, useRef } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";

const DEVELOPMENT_FIELDS = [
  'field1',
  'field2',
  // Add your fields here
];

export function YourPageClient() {
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

  const updateFieldInput = (fieldName: string, value: string) => {
    setFieldInputs(prev => ({ ...prev, [fieldName]: value }));
  };

  const getFieldHighlight = (fieldName: string) => {
    return highlightedFields.has(fieldName) 
      ? "bg-green-100 border-green-300 transition-colors duration-300" 
      : "";
  };

  // tRPC queries and mutations
  const {
    data: userData,
    refetch: refetchUserData,
    isLoading: isLoadingData,
  } = clientApi.internal.getUserData.useQuery();

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
        toast.success("Payload sent to n8n successfully!");
        setFieldInputs(prev => 
          Object.keys(prev).reduce((acc, key) => {
            acc[key] = "";
            return acc;
          }, {} as Record<string, string>)
        );
      },
      onError: (error) => {
        toast.error(`n8n send failed: ${error.message}`);
      },
    });

  // SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/user-updates");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          updatedFields?: string[];
          timestamp?: string;
        };

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your Page Title
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Live Updates Connected' : 'Disconnected'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Data Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Data Input Section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(fieldInputs).map((fieldName) => (
                <div key={fieldName} className="space-y-2">
                  <Label htmlFor={`${fieldName}-input`}>
                    {fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')}
                  </Label>
                  <Input
                    id={`${fieldName}-input`}
                    value={fieldInputs[fieldName] ?? ""}
                    onChange={(e) => updateFieldInput(fieldName, e.target.value)}
                    placeholder={`Enter ${fieldName} value`}
                    disabled={isUpdating}
                  />
                </div>
              ))}
              
              <Button 
                onClick={handleUpdateData} 
                disabled={isUpdating}
                className="w-full"
              >
                {isUpdating ? "Updating..." : "Save Data to Database"}
              </Button>
            </CardContent>
          </Card>

          {/* Data Display Section */}
          <Card>
            <CardHeader>
              <CardTitle>Current Database Values</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingData ? (
                <p className="text-muted-foreground">Loading data...</p>
              ) : (
                <>
                  {userData && Object.entries(userData as Record<string, unknown>)
                    .filter(([key]) => !['UID', 'created_at', 'updated_at'].includes(key))
                    .map(([fieldName, value]) => (
                      <div key={fieldName} className="space-y-2">
                        <Label>
                          {fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')} (Current Value)
                        </Label>
                        <div className={`p-3 border rounded-md bg-muted ${getFieldHighlight(fieldName)}`}>
                          {String(value) || "(empty)"}
                        </div>
                      </div>
                    ))
                  }
                  
                  {lastUpdate && (
                    <div className="text-sm text-muted-foreground">
                      Last updated via webhook: {new Date(lastUpdate).toLocaleString()}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* n8n Testing Section */}
        <Card>
          <CardHeader>
            <CardTitle>Send to n8n Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This section sends data to n8n for processing. After n8n completes its workflow,
              it will send a webhook back to update the UI with the processed results.
            </p>
            
            <Button 
              onClick={handleSendToN8n}
              className="w-full"
              disabled={isSendingToN8n || isUpdating}
            >
              {isSendingToN8n ? "Sending to n8n..." : "Send Data to n8n"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Server Component Template
```typescript
import { YourPageClient } from "./client-page";

export default function YourPage() {
  return <YourPageClient />;
}
```

## Troubleshooting Guide

### Common Errors and Solutions

**Error**: "Field does not exist in database"
**Solution**: Run `npm run add-field fieldName` and restart dev server

**Error**: "SSE connection failed"
**Solution**: Check `/api/stream/user-updates` endpoint is running

**Error**: "n8n webhook not received"
**Solution**: Verify n8n sends to `/api/webhooks/internal-updated` with correct format

**Error**: "TypeScript errors on fieldInputs"
**Solution**: Ensure all field names in DEVELOPMENT_FIELDS are strings

**Error**: "Fields not highlighting after webhook"
**Solution**: Check webhook includes correct `updatedFields` array

## Performance Tips

- Keep DEVELOPMENT_FIELDS array small (< 20 fields)
- Use field grouping for pages with many fields
- Avoid frequent database updates in n8n workflows
- Use batch operations when processing multiple fields 