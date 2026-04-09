import os
import sys

# ensure we import from the package
sys.path.insert(0, os.path.abspath('packages/aarm-sdk-python'))
from aarm_sdk import AarmClient, RawRequest

def test_sdk():
    client = AarmClient(
        base_url='http://localhost:3000',
        business_unit='TestUnit',
        application='PythonCli'
    )

    req1 = RawRequest(
        session_id='sess-no-dash',
        intent='search the web',
        user_prompt='How do I configure nginx SSL?',
        action_type='web_search',
        principal_id='user123'
    )
    
    print("Executing req1 (web_search) against actual backend...")
    res1 = client.mediate_action(req1)
    print(f"Result 1: {res1.status}")

if __name__ == '__main__':
    test_sdk()
