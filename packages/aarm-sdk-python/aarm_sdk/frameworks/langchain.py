import json
from typing import Optional, Union, Dict, Any

from ..client import AarmClient
from ..types import RawRequest

class LangchainHooks:
    def __init__(self, client: AarmClient, session_id: str, intent: str, options: Optional[Dict[str, str]] = None):
        self.client = client
        self.session_id = session_id
        self.intent = intent
        self.options = options or {}

    def on_tool_start(self, tool_name: str, tool_input: Union[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        parameters: Dict[str, Any] = {}
        if isinstance(tool_input, str):
            try:
                parameters = json.loads(tool_input)
            except json.JSONDecodeError:
                parameters = {"input": tool_input}
        else:
            parameters = tool_input

        # Merge base options and build request
        business_unit = self.options.get('business_unit')
        application = self.options.get('application')
        principal_id = self.options.get('principal_id')

        request = RawRequest(
            session_id=self.session_id,
            intent=self.intent,
            user_prompt='Intercepted tool call',
            action_type=tool_name,
            parameters=parameters,
            business_unit=business_unit,
            application=application,
            principal_id=principal_id
        )

        mediation = self.client.mediate_action(request)

        if mediation.status == 'DENY':
            raise Exception(f"AARM Policy Violation: Execution of tool '{tool_name}' was blocked. Reason: {mediation.execution_status}")

        return mediation.receipt

    def on_tool_end(self, tool_name: str, output: str) -> None:
        # Future architecture hooks for memory poisoning/drift checks based on tool output
        pass

def create_langchain_hooks(client: AarmClient, session_id: str, intent: str, **options) -> LangchainHooks:
    """
    Creates callbacks/hooks intended to integrate seamlessly with LangChain's Tool execution flow.
    Note: Actual LangChain types are omitted to avoid steep dependency overhead in the base SDK.
    """
    return LangchainHooks(client, session_id, intent, options)
