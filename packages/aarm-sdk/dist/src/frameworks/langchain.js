"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLangchainHooks = createLangchainHooks;
/**
 * Creates callbacks/hooks intended to integrate seamlessly with LangChain's Tool execution flow.
 * Note: Actual LangChain types are omitted to avoid steep dependency overhead in the base SDK.
 */
function createLangchainHooks(client, sessionId, intent, options) {
    return {
        /**
         * Call this before the tool runs to ensure AARM permits the action.
         * @param toolName The name of the tool
         * @param toolInput The parsed input given to the tool
         * @throws Error if the action is DENIED by AARM
         */
        onToolStart: async (toolName, toolInput) => {
            let parameters = {};
            if (typeof toolInput === 'string') {
                try {
                    parameters = JSON.parse(toolInput);
                }
                catch {
                    parameters = { input: toolInput };
                }
            }
            else {
                parameters = toolInput;
            }
            const mediation = await client.mediateAction({
                sessionId,
                intent,
                userPrompt: 'Intercepted tool call', // Ideally pass the exact current run prompt
                actionType: toolName,
                parameters,
                ...options // Passing the dynamic options like principalId
            });
            if (mediation.status === 'DENY') {
                throw new Error(`AARM Policy Violation: Execution of tool '${toolName}' was blocked. Reason: ${mediation.executionStatus}`);
            }
            // 'ALLOW' or 'STEP_UP' (which resolves to ALLOW if successful) continue execution.
            return mediation.receipt;
        },
        /**
         * Can be wired up if post-tool execution telemetry/auditing is needed by AARM in the future
         */
        onToolEnd: (toolName, output) => {
            // Future architecture hooks for memory poisoning/drift checks based on tool output
        }
    };
}
