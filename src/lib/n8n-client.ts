import { TRPCError } from "@trpc/server";
import { env } from "~/env";

export interface CallWorkflowOptions {
  endpoint: string;
  payload: unknown;
  user?: { id: string; email?: string | null };
}

export interface N8nWorkflowResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

class N8nClient {
  private baseUrl = env.N8N_BASE_URL;
  private secret = env.N8N_WEBHOOK_SECRET;
  private timeout = env.N8N_TIMEOUT;

  async callWorkflow<T>(opts: CallWorkflowOptions): Promise<N8nWorkflowResponse<T>> {
    const url = `${this.baseUrl}${opts.endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const body = {
      ...(opts.user ? { user_id: opts.user.id, user_email: opts.user.email } : {}),
      ...opts.payload,
    };

    try {
      console.info(`[n8n] calling workflow`, { url, body });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": this.secret,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 408) {
        throw new TRPCError({
          code: "TIMEOUT",
          message: "n8n workflow timed out, please try again",
        });
      }
      if (res.status === 400) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid data sent to n8n workflow",
        });
      }
      if (res.status >= 500) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "n8n workflow failed to execute",
        });
      }
      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to call n8n workflow",
        });
      }

      const json = (await res.json()) as N8nWorkflowResponse<T>;
      console.info(`[n8n] workflow response`, { url, status: res.status, json });
      return json;
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new TRPCError({
          code: "TIMEOUT",
          message: "n8n workflow timed out, please try again",
        });
      }
      console.error(`[n8n] unexpected error`, err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected n8n error",
      });
    }
  }
}

export const n8nClient = new N8nClient();
