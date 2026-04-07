import crypto from "node:crypto";
import { PolicyAction, PolicyContext } from "./PolicyEngine.ts";

export class ReceiptGenerator {
  secretKey: string;

  constructor() {
    this.secretKey = 'AARM_SECRET_KEY';
  }

  generate(action: PolicyAction, context: PolicyContext, policyResult: Record<string, unknown>, executionStatus: string) {
    const payload = {
      action,
      context,
      policyResult,
      executionStatus,
      timestamp: Date.now()
    };

    const payloadString = JSON.stringify(payload);
    
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payloadString)
      .digest('hex');

    return {
      header: { alg: "HS256", typ: "AARM-Receipt" },
      payload: payload,
      signature: signature
    };
  }
}

export const receiptGenerator = new ReceiptGenerator();
