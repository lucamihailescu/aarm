from aarm_sdk import AarmClient, RawRequest

def test_sdk():
    # Initializes with default HTTP transport to http://localhost:3000
    client = AarmClient(
        base_url='http://localhost:3000',
        business_unit='test-unit',
        application='python-cli-tester'
    )

    req1 = RawRequest(
        session_id='sess-1',
        intent='search the web',
        user_prompt='How do I configure nginx SSL?',
        action_type='web_search',
        principal_id='user123'
    )
    
    print("Executing req1 (web_search) against actual backend...")
    res1 = client.mediate_action(req1)
    print(f"Result 1: {res1}")

    req2 = RawRequest(
        session_id='sess-2',
        intent='delete database',
        user_prompt='rm -rf /production/db',
        action_type='malicious_tool',
        principal_id='user123'
    )
    
    print("\nExecuting req2 (malicious_tool) against actual backend...")
    res2 = client.mediate_action(req2)
    print(f"Result 2: {res2}")

if __name__ == '__main__':
    test_sdk()
