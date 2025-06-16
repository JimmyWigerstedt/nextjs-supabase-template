# n8n Integration Guide

This project connects your Next.js + tRPC backend with n8n workflows. Each workflow is triggered via a secure server-to-server call so your n8n instance remains hidden from the browser.

## Environment Setup

Add the following to your `.env` file and update with your values:

```bash
N8N_BASE_URL="https://your-n8n-instance.railway.app"
N8N_WEBHOOK_SECRET="your-secure-shared-secret-at-least-32-chars"
N8N_TIMEOUT=30000
```

## Adding a New Workflow

1. Copy `src/server/api/routers/n8n/workflows/template.ts` to a new file under `workflows/`.
2. Rename the router and procedure names to match your workflow.
3. Update the webhook `endpoint` to the n8n URL path.
4. Define the input schema with Zod.
5. Export the router and add it to `src/server/api/routers/n8n/index.ts`.
6. Call it from the frontend using `clientApi.n8n.<workflow>.<procedure>.useMutation()`.

When invoked via `n8nProcedure`, your Supabase user's `id` and `email` are automatically passed to the workflow under the `user` option. You only need to send your specific input data.

## Testing Workflows

- Use the demo page at `/n8n-demo` as a reference.
- Mock responses from n8n during development if needed.
- All errors are surfaced via `TRPCError` so the UI receives meaningful messages.

## Troubleshooting

- Ensure the webhook secret matches between this app and your n8n instance.
- Check console logs for `[n8n]` messages which include request and response details.
- Timeouts result in a `TIMEOUT` error—adjust `N8N_TIMEOUT` if necessary.
