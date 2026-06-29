import urllib.request
import urllib.error
import json
import sys

# Constants
SUPABASE_URL = "https://gushvedprjygyauwzvnf.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1c2h2ZWRwcmp5Z3lhdXd6dm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDcxOTMsImV4cCI6MjA5MDM4MzE5M30.8D_F-PBb-38VykX4Mk4pckCovaQ9z9IonPyDxTBsLBo"
API_URL = "https://propertystack.onrender.com"

# Read current local ADMIN_SECURITY_KEY from .env
local_key = None
try:
    with open("property-management-saas/apps/api/.env", "r") as f:
        for line in f:
            if line.startswith("ADMIN_SECURITY_KEY="):
                local_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
except Exception as e:
    print(f"Error reading local .env file: {e}")
    sys.exit(1)

if not local_key:
    print("Error: ADMIN_SECURITY_KEY not found in local .env")
    sys.exit(1)

print(f"Read local ADMIN_SECURITY_KEY: {local_key[:8]}...")

# 1. Sign in as admin@justhob.com to get access token
print("Authenticating with Supabase Auth...")
auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
auth_data = json.dumps({
    "email": "admin@justhob.com",
    "password": "Test1234!"
}).encode("utf-8")

auth_headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Content-Type": "application/json"
}

req = urllib.request.Request(auth_url, data=auth_data, headers=auth_headers, method="POST")
try:
    with urllib.request.urlopen(req) as res:
        res_data = json.loads(res.read().decode("utf-8"))
        token = res_data.get("access_token")
        print("Successfully obtained access token.")
except urllib.error.HTTPError as he:
    print(f"Authentication failed: {he.code} - {he.read().decode('utf-8', errors='ignore')}")
    sys.exit(1)
except Exception as e:
    print(f"Authentication failed: {e}")
    sys.exit(1)

# 2. Call verification endpoint on remote server
print("Verifying ADMIN_SECURITY_KEY on remote server...")
verify_url = f"{API_URL}/api/admin/verify"
verify_data = json.dumps({
    "securityKey": local_key
}).encode("utf-8")

verify_headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

req_verify = urllib.request.Request(verify_url, data=verify_data, headers=verify_headers, method="POST")
try:
    with urllib.request.urlopen(req_verify) as res_verify:
        body = res_verify.read().decode("utf-8")
        status = res_verify.status
        print(f"Verification Success! Status: {status}, Response: {body}")
except urllib.error.HTTPError as he:
    print(f"Verification Failed (HTTP Error): {he.code} - {he.read().decode('utf-8', errors='ignore')}")
except Exception as e:
    print(f"Verification Failed: {e}")
