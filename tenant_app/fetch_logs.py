import json
import urllib.request
import os

url = "https://api.github.com/repos/1djust/justhob/actions/runs"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    
run_id = data["workflow_runs"][0]["id"]
print(f"Run ID: {run_id}")

jobs_url = data["workflow_runs"][0]["jobs_url"]
req2 = urllib.request.Request(jobs_url)
with urllib.request.urlopen(req2) as response2:
    jobs_data = json.loads(response2.read().decode())
    job_id = jobs_data["jobs"][0]["id"]
    print(f"Job ID: {job_id}")
    
log_url = f"https://api.github.com/repos/1djust/justhob/actions/jobs/{job_id}/logs"
req3 = urllib.request.Request(log_url)
try:
    with urllib.request.urlopen(req3) as response3:
        logs = response3.read().decode()
        # Find the line with error or failed
        for i, line in enumerate(logs.split('\n')):
            if 'error:' in line.lower() or 'failed' in line.lower() or 'exception' in line.lower():
                print(f"L{i}: {line}")
except Exception as e:
    print(e)
