import type { CallWorkflowOptions } from "~/server/n8n/client";
import type { N8nContext } from "~/server/api/routers/n8n/base";

export const runTemplateWorkflow = async (
  ctx: N8nContext,
  data: Record<string, unknown>,
) => {
  // The wrapper on ctx.n8n will inject the user automatically
  return ctx.n8n.callWorkflow("template", { payload: data });
};
