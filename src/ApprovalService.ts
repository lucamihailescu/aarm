import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { PolicyAction, PolicyContext } from "./PolicyEngine.ts";

interface ApprovalRequest {
  id: string;
  action: PolicyAction;
  context: PolicyContext;
  policyResult: Record<string, unknown>;
  requestedAt: number;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

export class ApprovalService extends EventEmitter {
  pendingApprovals: Map<string, ApprovalRequest>;

  constructor() {
    super();
    this.pendingApprovals = new Map();
  }

  requestApproval(action: PolicyAction, context: PolicyContext, policyResult: Record<string, unknown>) {
    return new Promise((resolve, reject) => {
      const approvalId = crypto.randomUUID();
      
      const pendingRequest = {
        id: approvalId,
        action,
        context,
        policyResult,
        requestedAt: Date.now(),
        resolve,
        reject
      };

      this.pendingApprovals.set(approvalId, pendingRequest);
      
      this.emit('new_approval_request', pendingRequest);
    });
  }

  getPendingApprovals() {
    return Array.from(this.pendingApprovals.values()).map(req => ({
      id: req.id,
      action: req.action,
      context: req.context,
      policyResult: req.policyResult,
      requestedAt: req.requestedAt
    }));
  }

  resolveApproval(approvalId: string, approved: boolean, reviewer: string) {
    const request = this.pendingApprovals.get(approvalId);
    if (!request) {
      throw new Error("Approval request not found");
    }

    this.pendingApprovals.delete(approvalId);

    if (approved) {
      request.resolve({
        status: 'approved',
        reviewer,
        reviewedAt: Date.now()
      });
    } else {
      request.resolve({
        status: 'denied',
        reviewer,
        reviewedAt: Date.now()
      });
    }
  }
}

export const approvalService = new ApprovalService();
