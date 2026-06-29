if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  // Login to get token
  const loginRes = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "djokn@gmail.com", password: "Test1234!" }),
  });

  const loginData = await loginRes.json();
  const token =
    loginData.session?.access_token ||
    loginData.token ||
    loginData.access_token;

  if (!token) {
    console.log("No token in login response:", loginData);
    return;
  }

  // Fetch dashboard
  const res = await fetch("http://localhost:3001/api/tenant/dashboard", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  console.log(
    "Response tenant allowPartialPayments:",
    data.tenant?.allowPartialPayments,
  );
  console.log("Full tenant object keys:", Object.keys(data.tenant || {}));
}

main().catch(console.error);
