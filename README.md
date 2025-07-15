# Next.js + tRPC + Prisma + Supabase + N8N Template

**A production-ready template for building custom data management applications with real-time N8N integration and complete workflow tracking.**

This template provides **reusable patterns** and **copy-paste components** that enable rapid development of custom data management pages with N8N workflow integration, run history tracking, real-time updates, and full type safety.

## 🎯 **Template Philosophy**

This is a **starting point template** designed for customization. The architecture enables you to:

- **Build custom pages** by copying proven patterns
- **Add any fields** without backend code changes  
- **Integrate with N8N** using standardized payloads
- **Track workflow runs** with complete audit trails
- **Get real-time updates** automatically via webhooks
- **Maintain type safety** across the entire stack

**Key Principle:** Replace field names with your use case, keep the patterns identical.

## 🚀 **Quick Start for Custom Applications**

### For AI Assistants & Developers

1. **Study the patterns:** Read `docs/ai-assistant-template-guide.md` for complete templates
2. **Choose your use case:** E-commerce, CRM, support tickets, content management, etc.
3. **Define your fields:** Replace demo fields with your actual data needs
4. **Copy the template:** Use `src/app/n8n-demo/` as your reference implementation
5. **Build your workflow:** Create N8N workflows using the documented patterns

### Environment Setup

```bash
# Database connections
DATABASE_URL="your-supabase-database-url"
INTERNAL_DATABASE_URL="your-nocodb-database-url"

# Authentication
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# N8N Integration
N8N_BASE_URL="https://your-n8n-instance.com"
N8N_WEBHOOK_SECRET="your-secure-webhook-secret"
N8N_TIMEOUT=30000

# NocoDB Configuration
NC_SCHEMA="your-nocodb-schema-name"
```

## 📋 **Use Case Examples**

### E-commerce Order Management
```typescript
const INPUT_FIELDS = [
  'customerEmail',
  'productSku',
  'orderQuantity', 
  'shippingAddress',
  'paymentStatus'
];

const EXPECTED_RESULTS_SCHEMA = [
  'orderNumber',
  'trackingNumber',
  'estimatedDelivery',
  'processingStatus'
];
```

### Customer Support System
```typescript
const INPUT_FIELDS = [
  'ticketSubject',
  'issueCategory',
  'priorityLevel',
  'customerMessage',
  'assignedAgent'
];

const EXPECTED_RESULTS_SCHEMA = [
  'ticketNumber',
  'resolution',
  'escalationLevel',
  'responseTime'
];
```

### Content Management
```typescript
const INPUT_FIELDS = [
  'contentTitle',
  'contentType',
  'publishDate',
  'authorName',
  'contentStatus'
];

const EXPECTED_RESULTS_SCHEMA = [
  'contentId',
  'publishedUrl',
  'seoScore',
  'approvalStatus'
];
```

### CRM Lead Tracking
```typescript
const INPUT_FIELDS = [
  'leadSource',
  'companyName',
  'contactEmail',
  'leadScore',
  'salesStage'
];

const EXPECTED_RESULTS_SCHEMA = [
  'leadId',
  'qualificationScore',
  'nextAction',
  'assignedSalesRep'
];
```

## 🏗️ **Core Technology Stack**

- **[Next.js](https://nextjs.org)** - React web framework with App Router
- **[tRPC](https://trpc.io)** - End-to-end type-safe API layer
- **[Prisma](https://prisma.io)** - Type-safe database toolkit
- **[Supabase](https://supabase.com)** - Authentication and primary database
- **[Tailwind CSS](https://tailwindcss.com)** - Utility-first CSS framework
- **[ShadCN UI](https://ui.shadcn.com/)** - High-quality React components
- **[N8N](https://n8n.io)** - Workflow automation platform

## 📚 **Template Documentation**

### For AI Assistants
- **[AI Assistant Template Guide](docs/ai-assistant-template-guide.md)** - Complete copy-paste templates
- **[AI Assistant Patterns](docs/ai-assistant-patterns.md)** - Development patterns and mechanics  
- **[Quick Reference](docs/quick-reference.md)** - Fast lookup guide

### For Developers
- **[Data Lifecycle Examples](docs/data-lifecycle-examples.md)** - Complete data flow examples
- **[UI Component Patterns](docs/ui-component-patterns.md)** - Reusable UI building blocks
- **[N8N Integration](docs/n8n-integration.md)** - Workflow integration patterns

## 🔧 **Template Usage Patterns**

### Creating New Pages
```bash
# 1. Copy the template component
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx

# 2. Update the field arrays
const INPUT_FIELDS = ['customerName', 'orderStatus'];
const EXPECTED_RESULTS_SCHEMA = ['orderNumber', 'trackingCode'];

# 3. Set your workflow ID
const WORKFLOW_ID = 'your-workflow-name';

# 4. Customize the UI as needed
# Note: Results are automatically stored in results table
```

### N8N Workflow Pattern
```json
// Your workflow receives:
{
  "user_id": "user-uuid",
  "user_email": "user@example.com", 
  "usage_credits": 1000,
  "data": {
    "customerName": "John Doe",
    "orderStatus": "pending"
  },
  "action": "process",
  "run_id": "run-uuid",
  "workflow_id": "order-processing",
  "expected_results_schema": ["orderNumber", "trackingCode"]
}

// Your workflow sends back via webhook:
{
  "run_id": "run-uuid",
  "status": "completed",
  "results": {
    "orderNumber": "ORD-12345",
    "trackingCode": "TRACK-67890"
  },
  "credits_used": 10
}
```

## 🎯 **Template Benefits**

- **⚡ Rapid Development:** Create new pages in minutes, not hours
- **🔒 Type Safety:** Full TypeScript coverage from database to UI
- **📡 Real-time Updates:** Automatic UI refresh when N8N workflows complete
- **📊 Run History:** Complete audit trail of all workflow executions
- **🔄 Dynamic Fields:** Add new fields without backend code changes
- **🎨 Customizable:** Modify UI while keeping proven patterns
- **🛡️ Production Ready:** Security, validation, and error handling included

## 📖 **Data Fetching Options**

This template doesn't enforce a specific data fetching approach, giving you flexibility:

### Server-Side Rendering
```typescript
// Use tRPC server client in RSC
const userData = await api.internal.getUserData.query();
```

### Client-Side with TanStack Query
```typescript
// Use tRPC hooks in client components
const { data: userData } = api.internal.getUserData.useQuery();
```

See examples in `src/app/prefetch/`, `src/app/server-only-fetch/`, and `src/app/client-only-fetch/`.

## 🔧 **Development Workflow**

1. **Plan your fields:** What input data and expected results does your use case need?
2. **Copy template:** Use `n8n-demo` as your reference implementation
3. **Update field arrays:** Set `INPUT_FIELDS` and `EXPECTED_RESULTS_SCHEMA`
4. **Set workflow ID:** Define unique identifier for your N8N workflow
5. **Customize UI:** Update field names and styling to match your needs
6. **Build N8N workflow:** Create workflows using the documented patterns
7. **Test integration:** Verify data flow, run history, and real-time updates

## 🏆 **Template Success Stories**

This template enables you to build:
- **E-commerce order processing** systems with complete order tracking
- **Customer support ticket** management with response history
- **Content management** workflows with approval tracking
- **CRM lead tracking** systems with interaction history
- **Financial transaction** processing with audit trails
- **Inventory management** systems with stock movement tracking

## 📞 **Support & Community**

- **Template Issues:** Use GitHub Issues for template-specific questions
- **Pattern Questions:** Check the documentation files in `/docs/`
- **Custom Development:** Modify the template to fit your specific needs

## 📄 **License**

This template is open source and available under the MIT License. Use it as the foundation for your own custom applications.

---

**🚀 Ready to build your custom application?** Start with the [AI Assistant Template Guide](docs/ai-assistant-template-guide.md) and create your first custom page in minutes!
