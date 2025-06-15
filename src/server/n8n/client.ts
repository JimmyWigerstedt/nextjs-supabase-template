export interface CallWorkflowOptions {
  user?: { id: string; email: string };
  [key: string]: unknown;
}

export const n8nClient = {
  async callWorkflow(workflowId: string, options: CallWorkflowOptions) {
    // Placeholder for actual n8n workflow call
    console.log("Calling workflow", workflowId, options);
    return { workflowId, ...options };
  },
};
