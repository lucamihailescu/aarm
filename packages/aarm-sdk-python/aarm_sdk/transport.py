import json
import urllib.request
import urllib.error
from typing import Dict, Any

from .types import RawRequest, MediationResult

class Transport:
    """
    Transport interface defines how the AARM SDK communicates with the AARM Mediate service.
    This abstraction allows switching between REST (HTTP) and gRPC as needed.
    """
    def mediate(self, request: RawRequest) -> MediationResult:
        raise NotImplementedError("Transport.mediate must be implemented")

class RestTransport(Transport):
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')

    def mediate(self, request: RawRequest) -> MediationResult:
        endpoint = f"{self.base_url}/api/mediate"
        
        # Serialize the Request to a dict, excluding None values
        req_dict = {
            'sessionId': request.session_id,
            'intent': request.intent,
            'userPrompt': request.user_prompt,
            'actionType': request.action_type
        }
        if request.business_unit is not None:
            req_dict['businessUnit'] = request.business_unit
        if request.application is not None:
            req_dict['application'] = request.application
        if request.principal_id is not None:
            req_dict['principalId'] = request.principal_id
        if request.parameters is not None:
            req_dict['parameters'] = request.parameters

        data = json.dumps(req_dict).encode('utf-8')
        
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as response:
                body = response.read().decode('utf-8')
                result_dict = json.loads(body)
                return MediationResult(
                    status=result_dict.get('status', 'DENY'),
                    execution_status=result_dict.get('executionStatus', 'Unknown'),
                    receipt=result_dict.get('receipt')
                )
        except urllib.error.HTTPError as e:
            raise Exception(f"AARM Platform returned status {e.code}: {e.reason}") from e
class AsyncTransport:
    async def mediate(self, request: RawRequest) -> MediationResult:
        raise NotImplementedError("AsyncTransport.mediate must be implemented")

class AsyncRestTransport(AsyncTransport):
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        import httpx
        self.client = httpx.AsyncClient()

    async def mediate(self, request: RawRequest) -> MediationResult:
        endpoint = f"{self.base_url}/api/mediate"
        
        req_dict = {
            'sessionId': request.session_id,
            'intent': request.intent,
            'userPrompt': request.user_prompt,
            'actionType': request.action_type
        }
        if request.business_unit is not None:
            req_dict['businessUnit'] = request.business_unit
        if request.application is not None:
            req_dict['application'] = request.application
        if request.principal_id is not None:
            req_dict['principalId'] = request.principal_id
        if request.parameters is not None:
            req_dict['parameters'] = request.parameters

        try:
            response = await self.client.post(
                endpoint,
                json=req_dict,
                headers={'Accept': 'application/json'}
            )
            response.raise_for_status()
            result_dict = response.json()
            return MediationResult(
                status=result_dict.get('status', 'DENY'),
                execution_status=result_dict.get('executionStatus', 'Unknown'),
                receipt=result_dict.get('receipt')
            )
        except Exception as e:
            import httpx
            if isinstance(e, httpx.HTTPStatusError):
                raise Exception(f"AARM Platform returned status {e.response.status_code}") from e
            raise Exception(f"AARM Mediation failed: {str(e)}") from e

