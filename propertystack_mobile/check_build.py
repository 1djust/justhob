import json
import urllib.request
import zipfile
import shutil
import os

REPO = "1djust/justhob"
API = f"https://api.github.com/repos/{REPO}/actions/runs"

# Get latest run
req = urllib.request.Request(API)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())

run = data["workflow_runs"][0]
print(f"Latest run: {run['name']} | Status: {run['status']} | Conclusion: {run['conclusion']}")
print(f"Run ID: {run['id']}")
print(f"Artifacts URL: {run['artifacts_url']}")

# Get artifacts
req2 = urllib.request.Request(run['artifacts_url'])
with urllib.request.urlopen(req2) as resp2:
    artifacts = json.loads(resp2.read().decode())

if artifacts['total_count'] > 0:
    for art in artifacts['artifacts']:
        print(f"Artifact: {art['name']} | ID: {art['id']} | Size: {art['size_in_bytes']} bytes")
        print(f"Download URL: {art['archive_download_url']}")
else:
    print("No artifacts found yet. Build may still be running.")
