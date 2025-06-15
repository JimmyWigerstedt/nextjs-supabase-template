export interface WorkflowCallInput {
  endpoint: string;
  payload: unknown;
}

export interface WorkflowCallResult<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}
