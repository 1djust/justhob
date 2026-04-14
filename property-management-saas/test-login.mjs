const res = await fetch("http://localhost:3001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "manager@justhob.com", password: "Test1234!" })
});
const data = await res.json();
console.log("Login Status:", res.status);

if (data.access_token) {
  const syncRes = await fetch("http://localhost:3001/api/auth/sync", {
    method: "POST",
    headers: { "Authorization": `Bearer ${data.access_token}`, "Content-Type": "application/json" }
  });
  const syncData = await syncRes.json();
  console.log("Sync Status:", syncRes.status);
  console.log("Sync Response:", JSON.stringify(syncData, null, 2));
}
