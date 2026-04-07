# `aarm-sdk` (Python)

The official Python SDK for the AARM (Autonomous Action Runtime Management) Platform. This SDK allows you to embed AARM within any Python-based agent runtime to intermediate and record tool executions using declarative Cedar policies.

## Features

- **Zero Dependencies**: Built on standard `urllib.request`.
- **Framework Hooks**: Built-in support for orchestrating with LangChain python.
- **Secure Telemetry**: Send rich context traces and intent-drift detections directly from the runtime to the AARM platform.

## Installation

```bash
pip install aarm-sdk
```

## Basic Usage

The SDK is designed to be embedded directly before a tool is executed to intercept runtime intent.

```python
from aarm_sdk import AarmClient, RawRequest

# Initialize the client connected to your Policy Decision Engine (AARM)
# You can provide global defaults here
client = AarmClient(
    base_url='http://localhost:3000', # URL of AARM Gateway
    business_unit='Engineering',
    application='CustomerSupportAgent'
)

def intercept_tool(session_id: str, user_intent: str, tool_name: str, tool_input: dict, current_user_id: str):
    try:
        request = RawRequest(
            session_id=session_id,
            intent='Assist customer with billing',
            user_prompt=user_intent,
            action_type=tool_name,
            parameters=tool_input,
            principal_id=current_user_id
        )
        
        result = client.mediate_action(request)

        if result.status == 'DENY':
            print(f"Action blocked by AARM: {result.execution_status}")
            return False
            
        if result.status == 'ALLOW':
            print(f"Action permitted. Receipt Signature: {result.receipt.get('signature') if result.receipt else None}")
            # Proceed to run the tool logic here
            return True
            
    except Exception as err:
        print(f"Mediation error: {err}")
        return False
```

## Debugging & Logging

For troubleshooting, you can enable verbose Python logging natively within the client. It integrates directly with standard Python `logging`.

```python
import logging
from aarm_sdk import AarmClient

# Example 1: Console logging
client = AarmClient(
    base_url='http://localhost:3000',
    log_level=logging.DEBUG
)

# Example 2: File logging
file_client = AarmClient(
    base_url='http://localhost:3000',
    log_level=logging.DEBUG,
    log_file='/path/to/aarm.log'
)
```

## Framework Integrations

### LangChain

We ship a light integration designed to interface directly into the `tools` lifecycle.

```python
from aarm_sdk import AarmClient
from aarm_sdk.frameworks.langchain import create_langchain_hooks
from langchain_core.tools import tool

client = AarmClient(base_url='http://localhost:3000')

# Create hooks dynamically per session, ensuring the current user's principal_id is tracked
hooks = create_langchain_hooks(client, 'session-1234', 'read database', principal_id='user-789')

@tool("read_database")
def read_database(query: str) -> str:
    \"\"\"Reads user data from SQL\"\"\"
    
    # 1. AARM intercepts the request
    hooks.on_tool_start("read_database", query)
    
    # 2. Logic runs ONLY if allowed
    return '{"data": "Sensitive info"}'
```

## Transport Override

The SDK exposes `RestTransport` by default using `urllib`. Should you wish to use a custom transport mechanism (e.g. `httpx` for async or gRPC):

```python
from aarm_sdk.transport import Transport
from aarm_sdk.types import RawRequest, MediationResult
from aarm_sdk import AarmClient

class CustomAsyncTransport(Transport):
    async def mediate(self, request: RawRequest) -> MediationResult:
        # Send request asynchronously using httpx or aiohttp...
        return MediationResult(status='ALLOW', execution_status='OK')

client = AarmClient(
    base_url='http://async-server:9000',
    transport=CustomAsyncTransport() # Provide the transport override
)
```
