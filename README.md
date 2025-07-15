# Next.js Supabase Template - Production-Ready N8N Integration

**🎯 Purpose:** Rapid development template for building custom data management applications with N8N workflow integration, complete audit trails, and real-time updates.

**⚡ Template Philosophy:** Define your fields, copy the patterns, build in minutes not hours.

## 📋 What This Template Provides

### **Core Architecture**
- **Next.js 14** with App Router + tRPC for type-safe APIs
- **Dual Database System:** Supabase (auth) + Internal DB (app data + workflow tracking)
- **N8N Integration:** Standardized payload/response with complete run history
- **Results Table:** Full audit trail for every workflow execution with real-time status
- **Dynamic Field System:** Add fields without backend code changes
- **Stripe Integration:** Subscription management with usage-based billing

### **Template Capabilities**
- **5-minute adaptation:** Copy component → update field arrays → customize UI
- **Any use case:** E-commerce, CRM, support, content management, finance, etc.
- **Real-time tracking:** Live workflow status updates via Server-Sent Events
- **Complete history:** Every workflow run preserved with input/output data
- **Type safety:** Full TypeScript coverage from database to UI

## 🚀 Quick Start (5 Minutes)

### 1. **Define Your Use Case Fields**
```typescript
// Form data sent to N8N (temporary, cleared after send)
const INPUT_FIELDS = [
  'customerEmail',    // Replace with your input fields
  'productSku', 
  'orderQuantity'
];

// Expected outputs from N8N workflow (stored in results table)
const EXPECTED_RESULTS_SCHEMA = {
  orderStatus: 'string',      // Replace with your expected outputs
  trackingNumber: 'string',
  customerNotes: 'string'
};

const WORKFLOW_ID = 'order-processing'; // Your unique workflow identifier
```

### 2. **Copy Template Component**
```bash
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx
cp src/app/n8n-demo/page.tsx src/app/your-page/page.tsx
```

### 3. **Test Integration**
```bash
npm run dev
# Visit /your-page to test the workflow integration
```

## 📊 Data Flow Overview

```
User Input → Results Record Created → N8N Payload → N8N Processing → 
Webhook Response → Results Updated → Real-time UI Update → Complete Audit Trail
```

### **Key Benefits**
- **No database migrations needed** - Results table auto-created
- **Real-time status updates** - Live progress tracking
- **Complete audit trail** - Every execution preserved
- **Parallel processing** - Multiple workflows simultaneously
- **Error recovery** - Detailed failure tracking

## 🎯 Template Use Cases

### **E-commerce Order Processing**
```typescript
const INPUT_FIELDS = ['customerEmail', 'productSku', 'orderQuantity'];
const EXPECTED_RESULTS_SCHEMA = { orderStatus: 'string', trackingNumber: 'string' };
```

### **Customer Support System** 
```typescript
const INPUT_FIELDS = ['ticketSubject', 'issueCategory', 'priorityLevel'];
const EXPECTED_RESULTS_SCHEMA = { assignedAgent: 'string', ticketStatus: 'string' };
```

### **Content Management**
```typescript
const INPUT_FIELDS = ['contentTitle', 'contentType', 'authorName'];
const EXPECTED_RESULTS_SCHEMA = { contentStatus: 'string', publishedUrl: 'string' };
```

## 🔄 N8N Integration Pattern

### **Your N8N Workflow Receives:**
```json
{
  "user_id": "uuid",
  "id": "results-uuid-for-tracking", 
  "workflow_id": "your-workflow-name",
  "user_email": "user@example.com",
  "usage_credits": 1000,
  "data": {
    "customerEmail": "customer@example.com",
    "productSku": "PROD-123"
  },
  "expected_results_schema": {
    "orderStatus": "string",
    "trackingNumber": "string"
  },
  "action": "process"
}
```

### **Your N8N Workflow Sends Back:**
```json
{
  "id": "same-results-uuid-from-request",
  "status": "completed",
  "output_data": {
    "orderStatus": "processing", 
    "trackingNumber": "1Z999AA1234567890"
  },
  "credit_cost": 10
}
```

## 🏗️ Template Architecture

### **Results Table (Automatic)**
- Complete workflow run tracking with UUID primary keys
- JSONB storage for flexible input/output data
- Status progression: `processing` → `completed`/`failed`
- Performance metrics: duration, credit usage, error details

### **Real-time Updates**
- Server-Sent Events for live status updates
- Automatic UI refresh when workflows complete
- Connection management with heartbeat/reconnection

### **Type Safety**
- Full TypeScript coverage from database to UI  
- Dynamic field handling without type loss
- tRPC for end-to-end type safety

## 📚 Documentation Structure

### **For Template Usage:**
- **[TEMPLATE_GUIDE.md](./TEMPLATE_GUIDE.md)** - Complete adaptation guide with field examples
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant development instructions

### **For Technical Implementation:**
- **[DEVELOPERS.md](./DEVELOPERS.md)** - Architecture details, API contracts, database schema

## ⚡ Template Success Metrics

### **Development Speed**
- **Traditional approach:** 2-3 hours per workflow
- **Template approach:** 5-10 minutes per workflow  
- **Improvement:** 95% faster development

### **Features Included**
- ✅ Complete audit trail for compliance
- ✅ Real-time monitoring for operations
- ✅ Error recovery for reliability
- ✅ Credit tracking for billing
- ✅ Type safety for maintenance

## 🔧 Environment Setup

```bash
# Database connections
DATABASE_URL="your-supabase-database-url"
INTERNAL_DATABASE_URL="your-internal-database-url"

# N8N Integration  
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-secure-webhook-secret-min-32-chars"

# Schema Configuration
NC_SCHEMA="your-database-schema-name"
```

## 📞 Support

- **Template Issues:** GitHub Issues for template-specific questions
- **Pattern Questions:** Check TEMPLATE_GUIDE.md for comprehensive examples  
- **Technical Details:** See DEVELOPERS.md for implementation specifics

---

**🚀 Ready to build your workflow application?** Start with [TEMPLATE_GUIDE.md](./TEMPLATE_GUIDE.md) for complete field configuration examples and step-by-step adaptation process.