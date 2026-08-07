const email = 'manager@justhob.com';
const password = 'Test1234!';

async function run() {
  console.log('--- STARTING E2E MANAGER PAYMENT APPROVAL TEST ---');
  
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
  console.log('Logged in successfully. Access token obtained.');

  // Find workspace
  const workspaceId = loginData.user.workspaces[0].workspaceId;
  console.log(`Using workspaceId: ${workspaceId}`);

  // Payment to approve
  const paymentId = 'af25b2e5-e94d-4582-9116-ef99c2e0c0db';

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
