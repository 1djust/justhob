const { io } = require("socket.io-client");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "property-management-saas/apps/api/.env" });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Get manager token (manager@justhob.com, Test1234!)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "manager@justhob.com",
    password: "Test1234!"
  });
  
  if (error) {
    console.error("Login failed", error);
    return;
  }
  
  const token = data.session.access_token;
  console.log("Logged in as Manager. Connecting to socket...");
  
  const socket = io("http://localhost:3001", {
    auth: { token },
    transports: ["websocket"]
  });
  
  socket.on("connect", () => {
    console.log("Socket connected! ID:", socket.id);
  });
  
  socket.on("NOTIFICATION_CREATED", (msg) => {
    console.log("RECEIVED NOTIFICATION_CREATED:", msg);
  });
  
  // Wait a bit, then trigger the cron as admin
  setTimeout(async () => {
    console.log("Triggering cron jobs...");
    const res = await fetch("http://localhost:3001/api/admin/trigger-crons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ADMIN_SECURITY_KEY}` // Wait, this needs a valid super admin token OR the security key bypass
      },
      body: JSON.stringify({ securityKey: process.env.ADMIN_SECURITY_KEY })
    });
    const json = await res.json();
    console.log("Cron triggered:", json.success ? "Success" : json);
  }, 2000);
  
  setTimeout(() => {
    console.log("Done waiting.");
    process.exit(0);
  }, 10000);
}

run();
