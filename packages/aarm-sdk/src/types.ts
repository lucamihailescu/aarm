export interface RawRequest {
  sessionId: string;
  intent: string;
  userPrompt: string;
  businessUnit?: string;
  application?: string;
  principalId?: string;
  actionType: string;
  parameters?: Record<string, unknown>;
}

export interface ApprovalResponse {
  status: string;
  [key: string]: unknown;
}

export interface MediationResult {
  status: 'ALLOW' | 'DENY' | 'STEP_UP' | string;
  executionStatus: string;
  receipt?: {
    signature: string;
    actionId: string;
    timestamp: number;
    [key: string]: unknown;
  };
}

export interface AarmConfig {
  baseUrl: string;
  businessUnit?: string;
  application?: string;
  principalId?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...meta: any[]) => void;
}
