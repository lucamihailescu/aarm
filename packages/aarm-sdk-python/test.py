from aarm_sdk import AarmClient, RawRequest

# A mock transport for testing without a running server
from aarm_sdk.transport import Transport
from aarm_sdk.types import MediationResult

class MockTransport(Transport):
    def mediate(self, request: RawRequest) -> MediationResult:
        print(f"Mock Mediate called with: {request}")
        if request.action_type == "malicious_tool":
            return MediationResult(status='DENY', execution_status='Policy forbidden')
        return MediationResult(status='ALLOW', execution_status='OK', receipt={'signature': 'mock-sig-123'})

def test_sdk():
    client = AarmClient(
        base_url='http://localhost:3000',
        business_unit='test-unit',
        application='test-app',
        transport=MockTransport()
    )

    req1 = RawRequest(
        session_id='sess-1',
        intent='search the web',
        user_prompt='how to do x',
        action_type='web_search'
    )
    res1 = client.mediate_action(req1)
    print(f"Result 1: {res1}")

    req2 = RawRequest(
        session_id='sess-2',
        intent='do bad things',
        user_prompt='hack',
        action_type='malicious_tool'
    )
    res2 = client.mediate_action(req2)
    print(f"Result 2: {res2}")

if __name__ == '__main__':
    test_sdk()
