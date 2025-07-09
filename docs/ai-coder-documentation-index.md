# AI Coder Documentation - Streamlined for Template Adaptation

## 📋 Documentation Structure

This streamlined documentation is designed specifically for **AI coder assistants** who need to adapt the Next.js/N8N template for different use cases. The focus is on **template adaptation**, not infrastructure setup.

### Core Principle: Separation of Concerns

- **👨‍💻 Developer Responsibility**: Database fields, N8N workflows, infrastructure setup
- **🤖 AI Coder Responsibility**: Template adaptation, component customization, field configuration

## 📚 Documentation Files

### 1. [Quick Reference](./ai-coder-quick-reference.md) *(1 page)*
**Purpose**: Instant reference for common adaptation tasks

**Contents**:
- Template adaptation checklist
- Field configuration patterns for common use cases
- Component customization rules (what to change vs never modify)
- API contract formats
- Common validation patterns

**Use when**: You need a quick reminder of the adaptation process or want to see field patterns for different use cases.

### 2. [Template Guide](./ai-coder-template-guide.md) *(2-3 pages)*
**Purpose**: Complete copy-paste template with detailed annotations

**Contents**:
- Full annotated component with customization points marked
- Field types distinction (INPUT_FIELDS vs PERSISTENT_FIELDS)
- Complete working examples for multiple use cases
- Customization patterns and validation logic
- UI layout patterns

**Use when**: You're creating a new page from scratch or need to understand the complete component structure.

### 3. [Integration Contracts](./ai-coder-integration-contracts.md) *(1 page)*
**Purpose**: Black box specifications for N8N and SSE integration

**Contents**:
- Exact N8N payload and response formats
- SSE message format and behavior
- Error handling patterns
- Field validation contracts
- Testing procedures

**Use when**: You need to understand what data flows between the template and N8N, or how real-time updates work.

## 🎯 How to Use This Documentation

### For New Template Adaptation

1. **Start with [Quick Reference](./ai-coder-quick-reference.md)**
   - Review the adaptation checklist
   - Choose field patterns for your use case
   - Understand what to customize vs what to keep

2. **Copy from [Template Guide](./ai-coder-template-guide.md)**
   - Use the complete annotated component
   - Follow the customization annotations
   - Adapt field arrays and UI elements

3. **Reference [Integration Contracts](./ai-coder-integration-contracts.md)**
   - Understand the N8N payload format
   - Verify SSE update behavior
   - Check error handling patterns

### For Troubleshooting

1. **Check [Integration Contracts](./ai-coder-integration-contracts.md)** for API format issues
2. **Review [Template Guide](./ai-coder-template-guide.md)** for component structure questions
3. **Consult [Quick Reference](./ai-coder-quick-reference.md)** for validation patterns

## 🚫 What's NOT in This Documentation

This streamlined documentation intentionally **excludes**:

- **N8N workflow creation guides** *(Developer responsibility)*
- **Database setup instructions** *(Developer responsibility)*
- **Environment configuration** *(Developer responsibility)*
- **Infrastructure deployment** *(Developer responsibility)*
- **Field addition scripts** *(Developer responsibility)*

## ✅ What IS in This Documentation

This documentation **focuses on**:

- **Template component structure** *(AI coder responsibility)*
- **Field configuration patterns** *(AI coder responsibility)*
- **Component customization** *(AI coder responsibility)*
- **API contract formats** *(AI coder needs to know)*
- **UI adaptation patterns** *(AI coder responsibility)*

## 🎨 Adaptation Philosophy

### Trust the Developer Setup

- **Database fields exist**: Trust that developer has added PERSISTENT_FIELDS using `npm run add-field`
- **N8N workflows work**: Trust that developer has configured N8N to handle your payload format
- **Environment is ready**: Trust that developer has set up all required environment variables

### Focus on Template Adaptation

- **Component structure**: Copy the template exactly, modify only marked customization points
- **Field arrays**: Replace with your use case fields
- **UI customization**: Adapt labels, validation, and layout
- **API contracts**: Understand the format but don't modify the infrastructure

## 🔄 Typical Adaptation Workflow

1. **Copy template files**
2. **Update field arrays** (INPUT_FIELDS, PERSISTENT_FIELDS)
3. **Customize component name and page title**
4. **Add field validation** (optional)
5. **Customize UI layout** (optional)
6. **Test with developer's N8N workflow**

## 📝 Template Adaptation Success Criteria

An AI coder should be able to:

✅ Copy the template component structure  
✅ Update field arrays for their use case  
✅ Customize UI elements and validation  
✅ Understand the N8N payload/response format  
✅ Test the integration end-to-end  

**Without needing to know:**
- How to create N8N workflows
- How to set up databases
- How to configure environment variables
- How to deploy infrastructure

## 🎯 Key Insights

### Field Types Matter
- **INPUT_FIELDS**: Form inputs → N8N payload → cleared after send
- **PERSISTENT_FIELDS**: Database storage → display/edit → real-time updates

### Template Boundaries
- **Never modify**: Core state management, tRPC patterns, SSE logic
- **Always customize**: Field arrays, component name, UI elements
- **Optionally customize**: Validation, formatting, layout

### Integration is Black Box
- N8N receives standardized payload format
- N8N sends standardized response format
- Real-time updates happen automatically
- Error handling is built-in

This documentation structure ensures AI coders can focus on template adaptation without getting lost in infrastructure details. 