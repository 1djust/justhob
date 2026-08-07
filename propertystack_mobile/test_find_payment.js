const email = 'landlord@justhob.com';
const password = 'Test1234!';

async function run() {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  const token = loginData.access_token;
  const workspaceId = loginData.user.workspaces[0].workspaceId;

  const p2Res = await fetch(`http://localhost:3001/api/workspaces/${workspaceId}/payments?page=2`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const p2 = await p2Res.json();
  
  const paymentId = '0e4dc10a-7b8c-43ba-98ba-30ee6205b0c6';
  console.log('p2 response:', p2);
}

run().catch(console.error);
