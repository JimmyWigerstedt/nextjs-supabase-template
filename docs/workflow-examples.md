# Workflow Examples

This document showcases example payloads and responses when calling n8n workflows from tRPC.

## Example Input

```typescript
clientApi.n8n.template.processTemplate.mutate({
  data: { sample: "data" },
  action: "process"
});
```
// The user's id and email are injected automatically by `n8nProcedure`.

## Example Output

```json
{
  "success": true,
  "data": { "result": "ok" },
  "message": "Processed"
}
```

## Error Handling

- `BAD_REQUEST` – Input validation failed or n8n returned 400
- `TIMEOUT` – Workflow exceeded the timeout defined by `N8N_TIMEOUT`
- `INTERNAL_SERVER_ERROR` – n8n encountered an error

Use these patterns when designing your own workflows to keep responses consistent.
