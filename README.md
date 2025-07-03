# Next.js + tRPC + Prisma + Supabase + N8N Template

**A production-ready template for building custom data management applications with real-time N8N integration.**

This template provides **reusable patterns** and **copy-paste components** that enable rapid development of custom data management pages with N8N workflow integration, real-time updates, and full type safety.

## 🎯 **Template Philosophy**

This is a **starting point template** designed for customization. The architecture enables you to:

- **Build custom pages** by copying proven patterns
- **Add any fields** without backend code changes  
- **Integrate with N8N** using standardized payloads
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
const DEVELOPMENT_FIELDS = [
  'customerEmail',
  'productSku',
  'orderQuantity', 
  'shippingAddress',
  'paymentStatus'
];
```

### Customer Support System
```typescript
const DEVELOPMENT_FIELDS = [
  'ticketSubject',
  'issueCategory',
  'priorityLevel',
  'customerMessage',
  'assignedAgent'
];
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
```

### CRM Lead Tracking
```typescript
const DEVELOPMENT_FIELDS = [
  'leadSource',
  'companyName',
  'contactEmail',
  'leadScore',
  'salesStage'
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
# 1. Add your database fields
npm run add-field customerName
npm run add-field orderStatus

# 2. Copy the template component
cp src/app/n8n-demo/client-page.tsx src/app/your-page/client-page.tsx

# 3. Update the DEVELOPMENT_FIELDS array
const DEVELOPMENT_FIELDS = ['customerName', 'orderStatus'];

# 4. Customize the UI as needed
```

### N8N Workflow Pattern
```json
// Your workflow receives:
{
  "user_id": "user-uuid",
  "user_email": "user@example.com", 
  "data": {
    "customerName": "John Doe",
    "orderStatus": "pending"
  },
  "action": "process"
}

// Your workflow sends back:
{
  "user_id": "user-uuid",
  "updatedFields": ["customerName", "orderStatus"]
}
```

## 🎯 **Template Benefits**

- **⚡ Rapid Development:** Create new pages in minutes, not hours
- **🔒 Type Safety:** Full TypeScript coverage from database to UI
- **📡 Real-time Updates:** Automatic UI refresh when N8N workflows complete
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

1. **Plan your fields:** What data does your use case need?
2. **Add to database:** Use `npm run add-field fieldName` for each field
3. **Copy template:** Use `n8n-demo` as your reference implementation
4. **Customize UI:** Update field names and styling to match your needs
5. **Build N8N workflow:** Create workflows using the documented patterns
6. **Test integration:** Verify data flow and real-time updates

## 🏆 **Template Success Stories**

This template enables you to build:
- **E-commerce order processing** systems
- **Customer support ticket** management
- **Content management** workflows
- **CRM lead tracking** systems
- **Financial transaction** processing
- **Inventory management** systems

## 📞 **Support & Community**

- **Template Issues:** Use GitHub Issues for template-specific questions
- **Pattern Questions:** Check the documentation files in `/docs/`
- **Custom Development:** Modify the template to fit your specific needs

## 📄 **License**

This template is open source and available under the MIT License. Use it as the foundation for your own custom applications.

---

**🚀 Ready to build your custom application?** Start with the [AI Assistant Template Guide](docs/ai-assistant-template-guide.md) and create your first custom page in minutes!
