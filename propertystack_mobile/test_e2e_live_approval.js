const email = 'manager@justhob.com';
const password = 'Test1234!';

async function run() {
  console.log('--- STARTING E2E LIVE SOCKET APPROVAL SIMULATION ---');
  
  // 1. Log in to get authentication token
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
  console.log(`Using workspaceId: ${workspaceId}`);

  // The payment currently displayed on the Landlord's screen
  const paymentId = '9c63886f-332a-494b-80a0-7abf88824930';

  // 2. Approve payment
  console.log(`Approving payment ${paymentId}...`);
  const approveRes = await fetch(`http://localhost:3001/api/workspaces/${workspaceId}/payments/${paymentId}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'PAID',
      approvedAmountPaid: 150000
    })
  });

  if (!approveRes.ok) {
    throw new Error('Approval failed: ' + await approveRes.text());
  }
  console.log('SUCCESS: Payment approved successfully by manager!');
}

run().catch(console.error);
