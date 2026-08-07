const email = 'manager@justhob.com';
const password = 'Test1234!';

async function run() {
  console.log('🚀 Logging in as Manager...');
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
  console.log(`LoggedIn. Workspace: ${workspaceId}`);

  // Fetch payments to get the leaseId dynamically
  console.log('Fetching active lease ID...');
  const paymentsRes = await fetch(`http://localhost:3001/api/workspaces/${workspaceId}/payments?page=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const paymentsData = await paymentsRes.json();
  if (!paymentsData.payments || paymentsData.payments.length === 0) {
    throw new Error('No existing payments or leases found in workspace!');
  }
  const leaseId = paymentsData.payments[0].leaseId;
  console.log(`Using Lease ID: ${leaseId}`);

  // Create payment under review
  console.log('Creating new payment with status UNDER_REVIEW...');
  const createRes = await fetch(`http://localhost:3001/api/workspaces/${workspaceId}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      leaseId: leaseId,
      amount: 150000,
      dueDate: new Date().toISOString(),
      status: 'UNDER_REVIEW',
      note: 'Tenant payment proof submitted'
    })
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    console.error('❌ Creation failed:', errorText);
    
    // If the creation failed due to limit, let's fallback to Prisma direct insert + database query
    if (createRes.status === 402) {
      console.log('⚠️ Limit hit, please restart the backend server or check database.');
    }
    throw new Error('API Payment Creation failed.');
  }

  const createData = await createRes.json();
  console.log(`\n✅ SUCCESS! Created payment under review via API:`);
  console.log(`- Payment ID: ${createData.payment.id}`);
  console.log(`- Amount:     ₦${createData.payment.amount}`);
  console.log(`- Status:     ${createData.payment.status}`);
}

run().catch(console.error);
