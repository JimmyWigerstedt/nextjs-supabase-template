import {
  authroizedProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import { n8nClient, type CallWorkflowOptions } from "~/server/n8n/client";

export const n8nRouter = createTRPCRouter({});

const n8nMiddleware = authroizedProcedure.use(async ({ ctx, next }) => {
  const callWorkflow = (
    id: string,
    options: Omit<CallWorkflowOptions, "user">
  ) =>
    n8nClient.callWorkflow(id, {
      ...options,
      user: { id: ctx.supabaseUser.id, email: ctx.supabaseUser.email },
    });

  return next({
    ctx: { ...ctx, n8n: { callWorkflow } },
  });
});

export const n8nProcedure = authroizedProcedure.use(n8nMiddleware);

export type N8nContext = {
  n8n: {
    callWorkflow: (
      id: string,
      options: Omit<CallWorkflowOptions, "user">
    ) => Promise<unknown>;
  };
};
