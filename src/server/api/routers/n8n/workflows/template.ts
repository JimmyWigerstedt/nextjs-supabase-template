import { z } from "zod";
import { n8nProcedure } from "../base";
import { createTRPCRouter } from "~/server/api/trpc";

export const templateRouter = createTRPCRouter({
  processTemplate: n8nProcedure
    .input(
      z.object({
        data: z.any(),
        action: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.n8nClient.callWorkflow({
        endpoint: "/webhook/your-n8n-endpoint",
        payload: input,
      });

      return result;
    }),
});
