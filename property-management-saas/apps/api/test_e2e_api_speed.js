"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = "https://gushvedprjygyauwzvnf.supabase.co";
const email = "manager_pro@justhob.com";
const password = "Test1234!";
async function testSpeed() {
    console.log("=== Local API Performance Test ===");
    // 1. Authenticate with Supabase
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1c2h2ZWRwcmp5Z3lhdXd6dm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDcxOTMsImV4cCI6MjA5MDM4MzE5M30.8D_F-PBb-38VykX4Mk4pckCovaQ9z9IonPyDxTBsLBo");
    console.log("Authenticating as manager_pro@justhob.com...");
    const authStart = Date.now();
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error || !data.session) {
        console.error("Auth failed:", error);
        return;
    }
    const token = data.session.access_token;
    console.log(`Authenticated successfully in ${Date.now() - authStart}ms`);
    const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
    const API_URL = "http://localhost:3001";
    const workspaceId = "468f2272-f15d-4fe7-88a4-cdf26893c48d";
    const endpoints = [
        { name: "Get Profile (/api/auth/me)", url: `${API_URL}/api/auth/me` },
        {
            name: "Workspace Stats (/stats)",
            url: `${API_URL}/api/workspaces/${workspaceId}/stats`,
        },
        {
            name: "Properties List",
            url: `${API_URL}/api/workspaces/${workspaceId}/properties`,
        },
        {
            name: "Tenants List",
            url: `${API_URL}/api/workspaces/${workspaceId}/tenants`,
        },
        {
            name: "Payments List",
            url: `${API_URL}/api/workspaces/${workspaceId}/payments`,
        },
        {
            name: "Maintenance Requests",
            url: `${API_URL}/api/workspaces/${workspaceId}/maintenance`,
        },
    ];
    for (const endpoint of endpoints) {
        console.log(`Fetching ${endpoint.name}...`);
        const start = Date.now();
        try {
            const res = await fetch(endpoint.url, { headers });
            const responseTime = Date.now() - start;
            const json = await res.json();
            console.log(`  Status: ${res.status}`);
            console.log(`  Response Time: ${responseTime}ms`);
        }
        catch (e) {
            console.error(`  Failed to fetch ${endpoint.name}:`, e);
        }
    }
}
testSpeed();
