import urllib.request
import json

# Let's hit the telemetry API to see what we can find
req = urllib.request.Request("http://localhost:3000/api/telemetry")
with urllib.request.urlopen(req) as response:
    print(response.read().decode('utf-8')[:2000])

