export interface WorkflowCallInput {
  endpoint: string;
  payload: Record<string, unknown>;
}

export interface WorkflowCallResult<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}
