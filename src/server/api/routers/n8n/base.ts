import { z } from "zod";
import { authorizedProcedure } from "~/server/api/trpc";
import { n8nClient, type CallWorkflowOptions } from "~/lib/n8n-client";

export const n8nProcedure = authorizedProcedure.use(async ({ ctx, next }) => {
  const client = {
    ...n8nClient,
    callWorkflow: (opts: Omit<CallWorkflowOptions, "user">) =>
      n8nClient.callWorkflow({
        ...opts,
        // `authorizedProcedure` guarantees a `supabaseUser` is present, but the
        // context type still allows `null`. Use a non-null assertion here to
        // satisfy TypeScript while keeping the runtime check centralized.
        user: {
          id: ctx.supabaseUser!.id,
          email: ctx.supabaseUser!.email,
        },
      }),
  } as typeof n8nClient;

  return next({
    ctx: {
      ...ctx,
      n8nClient: client,
    },
  });
});

export const n8nRequestSchema = z.object({
  workflowData: z.any(),
  workflowType: z.string(),
});

export const n8nResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  message: z.string().optional(),
});
