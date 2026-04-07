
import { contextAccumulator } from './ContextAccumulator.ts';
import { policyEngine, PolicyContext } from './PolicyEngine.ts';
import { approvalService } from './ApprovalService.ts';
import { receiptGenerator } from './ReceiptGenerator.ts';
import { telemetryExporter } from './TelemetryExporter.ts';

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

export class ActionMediationLayer {

  async mediate(rawRequest: RawRequest) {
    const action = this.normalize(rawRequest);

    const context: PolicyContext & Record<string, unknown> = {
      ...contextAccumulator.accumulate(
        rawRequest.sessionId,
        rawRequest.intent,
        rawRequest.userPrompt
      ),
      // Enrich with namespace routing data
      businessUnit: rawRequest.businessUnit,
      application: rawRequest.application,
      principalId: rawRequest.principalId
    };

    const policyResult = policyEngine.evaluate(action, context);

    let finalDecision = policyResult.decision;
    let approvalDetails = null;

    if (finalDecision === 'STEP_UP') {
      telemetryExporter.exportEvent('ACTION_PAUSED', { 
        action, 
        reason: 'Pending human approval',
        context,
        sessionId: rawRequest.sessionId
      });
      
      const approvalResponse = await approvalService.requestApproval(action, context, policyResult) as ApprovalResponse;
      
      if (approvalResponse.status === 'approved') {
        const updatedContext = { ...context, isApproved: true };
        const reEval = policyEngine.evaluate(action, updatedContext);
        finalDecision = reEval.decision;
        approvalDetails = approvalResponse;
      } else {
        finalDecision = 'DENY';
        approvalDetails = approvalResponse;
      }
    }

    let executionStatus = 'Blocked by policy';
    if (finalDecision === 'ALLOW') {
      executionStatus = 'Executed successfully';
    }

    const receipt = receiptGenerator.generate(
      action,
      context,
      { ...policyResult, finalDecision, approvalDetails },
      executionStatus
    );

    telemetryExporter.exportEvent('ACTION_MEDIATED', {
      actionId: action.id,
      actionType: action.type,
      decision: finalDecision,
      executionStatus,
      receiptSignature: receipt.signature,
      action,
      context,
      sessionId: rawRequest.sessionId
    });

    return {
      status: finalDecision,
      executionStatus,
      receipt
    };
  }

  normalize(rawRequest: RawRequest) {
    return {
      id: crypto.randomUUID(),
      type: rawRequest.actionType,
      payload: rawRequest.parameters || {},
      requestedAt: Date.now()
    };
  }
}

export const aml = new ActionMediationLayer();
