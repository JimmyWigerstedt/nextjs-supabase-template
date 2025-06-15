import { createTRPCRouter } from "~/server/api/trpc";
import { templateRouter } from "./workflows/template";

export const n8nRouter = createTRPCRouter({
  template: templateRouter,
});
