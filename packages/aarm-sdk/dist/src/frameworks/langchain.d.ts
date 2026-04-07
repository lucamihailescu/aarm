import { AarmClient } from '../client';
/**
 * Core configuration overrides for the LangChain session hooks
 */
export interface LangChainHookOptions {
    businessUnit?: string;
    application?: string;
    principalId?: string;
}
/**
 * Creates callbacks/hooks intended to integrate seamlessly with LangChain's Tool execution flow.
 * Note: Actual LangChain types are omitted to avoid steep dependency overhead in the base SDK.
 */
export declare function createLangchainHooks(client: AarmClient, sessionId: string, intent: string, options?: LangChainHookOptions): {
    /**
     * Call this before the tool runs to ensure AARM permits the action.
     * @param toolName The name of the tool
     * @param toolInput The parsed input given to the tool
     * @throws Error if the action is DENIED by AARM
     */
    onToolStart: (toolName: string, toolInput: string | Record<string, unknown>) => Promise<{
        [key: string]: unknown;
        signature: string;
        actionId: string;
        timestamp: number;
    } | undefined>;
    /**
     * Can be wired up if post-tool execution telemetry/auditing is needed by AARM in the future
     */
    onToolEnd: (toolName: string, output: string) => void;
};
