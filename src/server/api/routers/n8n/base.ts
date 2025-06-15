import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authroizedProcedure } from "~/server/api/trpc";
import { n8nClient } from "~/lib/n8n-client";

export const n8nProcedure = authroizedProcedure.use(async ({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      n8nClient,
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
