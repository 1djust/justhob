const email = 'landlord@justhob.com';
const password = 'Test1234!';

async function run() {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!loginRes.ok) {
    throw new Error('Login failed: ' + await loginRes.text());
  }
  const loginData = await loginRes.json();
  const token = loginData.access_token;
  const workspaceId = loginData.user.workspaces[0].workspaceId;
  console.log(`Successfully logged in. Workspace ID: ${workspaceId}`);

  const paymentsRes = await fetch(`http://localhost:3001/api/workspaces/${workspaceId}/payments`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!paymentsRes.ok) {
    throw new Error('Failed to fetch payments: ' + await paymentsRes.text());
  }

  const payments = await paymentsRes.json();
  console.log('Payments API response:', payments);
}

run().catch(console.error);
