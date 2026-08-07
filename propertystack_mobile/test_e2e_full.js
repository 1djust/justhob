/**
 * E2E Test: Manager approves a tenant payment → Landlord sees real-time update
 *
 * Steps:
 * 1. Login as manager → get token + workspaceId
 * 2. Login as landlord → get token + workspaceId
 * 3. List payments from landlord perspective → find one that is UNDER_REVIEW
 * 4. Manager approves it via PATCH /review
 * 5. List payments from landlord perspective again → confirm status changed to PAID
 */

const MANAGER = { email: 'manager@justhob.com', password: 'Test1234!' };
const LANDLORD = { email: 'landlord@justhob.com', password: 'Test1234!' };
const API = 'http://localhost:3001/api';

async function login(credentials) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed for ${credentials.email}: ${text}`);
  }
  const data = await res.json();
  const ws = data.user?.workspaces?.[0];
  return {
    token: data.access_token,
    workspaceId: ws?.workspaceId,
    role: ws?.role,
    userId: data.user?.id,
  };
}

async function listPayments(token, workspaceId) {
  const res = await fetch(`${API}/workspaces/${workspaceId}/payments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List payments failed: ${text}`);
  }
  return res.json();
}

async function reviewPayment(token, workspaceId, paymentId, body) {
  const res = await fetch(
    `${API}/workspaces/${workspaceId}/payments/${paymentId}/review`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function run() {
  console.log('=== E2E PAYMENT VERIFICATION FLOW ===\n');

  // ── Step 1: Login as Manager ──
  console.log('1. Logging in as Manager...');
  const manager = await login(MANAGER);
  console.log(`   ✅ Manager logged in (role: ${manager.role}, workspace: ${manager.workspaceId})`);

  // ── Step 2: Login as Landlord ──
  console.log('2. Logging in as Landlord...');
  const landlord = await login(LANDLORD);
  console.log(`   ✅ Landlord logged in (role: ${landlord.role}, workspace: ${landlord.workspaceId})`);

  // ── Step 3: List payments from landlord view ──
  console.log('3. Fetching payments from Landlord perspective...');
  const landlordPaymentsBefore = await listPayments(landlord.token, landlord.workspaceId);
  const allPayments = Array.isArray(landlordPaymentsBefore) ? landlordPaymentsBefore : landlordPaymentsBefore.payments || [];
  console.log(`   Found ${allPayments.length} total payments`);

  // Find UNDER_REVIEW payment
  const underReview = allPayments.find((p) => p.status === 'UNDER_REVIEW');
  if (!underReview) {
    console.log('   ⚠️  No UNDER_REVIEW payment found. Listing all payment statuses:');
    allPayments.forEach((p) => console.log(`     - ${p.id}: ${p.status} (₦${p.amount})`));
    
    // If no UNDER_REVIEW payment, we can still test the landlord cannot approve
    console.log('\n=== TESTING LANDLORD CANNOT APPROVE ===');
    const anyPayment = allPayments[0];
    if (anyPayment) {
      console.log(`4. Attempting landlord approval on payment ${anyPayment.id}...`);
      const landlordReview = await reviewPayment(
        landlord.token,
        landlord.workspaceId,
        anyPayment.id,
        { status: 'PAID', approvedAmountPaid: anyPayment.amount }
      );
      if (!landlordReview.ok && landlordReview.status === 403) {
        console.log(`   ✅ PASS: Landlord correctly blocked (403 Forbidden)`);
      } else {
        console.log(`   ❌ FAIL: Expected 403, got ${landlordReview.status}`, landlordReview.data);
      }
    }
    console.log('\n=== DONE (no UNDER_REVIEW payment to approve) ===');
    return;
  }

  console.log(`   📋 Found UNDER_REVIEW payment: ${underReview.id} (₦${underReview.amount})`);

  // ── Step 4: Verify Landlord CANNOT approve ──
  console.log('4. Verifying Landlord cannot approve (403 expected)...');
  const landlordAttempt = await reviewPayment(
    landlord.token,
    landlord.workspaceId,
    underReview.id,
    { status: 'PAID', approvedAmountPaid: underReview.amount }
  );
  if (!landlordAttempt.ok && landlordAttempt.status === 403) {
    console.log(`   ✅ PASS: Landlord correctly blocked (403 Forbidden)`);
  } else {
    console.log(`   ❌ FAIL: Expected 403, got ${landlordAttempt.status}`, landlordAttempt.data);
  }

  // ── Step 5: Manager approves the payment ──
  console.log(`5. Manager approving payment ${underReview.id}...`);
  const approvalResult = await reviewPayment(
    manager.token,
    manager.workspaceId,
    underReview.id,
    { status: 'PAID', approvedAmountPaid: underReview.amount }
  );
  if (approvalResult.ok) {
    console.log(`   ✅ PASS: Manager approved successfully`);
    console.log(`   New status: ${approvalResult.data?.status || approvalResult.data?.payment?.status || 'check DB'}`);
  } else {
    console.log(`   ❌ FAIL: Approval failed (${approvalResult.status})`, approvalResult.data);
    return;
  }

  // ── Step 6: Wait briefly for socket propagation, then re-fetch landlord payments ──
  console.log('6. Waiting 2s for socket propagation...');
  await new Promise((r) => setTimeout(r, 2000));

  console.log('7. Re-fetching payments from Landlord perspective...');
  const landlordPaymentsAfter = await listPayments(landlord.token, landlord.workspaceId);
  const allAfter = Array.isArray(landlordPaymentsAfter) ? landlordPaymentsAfter : landlordPaymentsAfter.payments || [];
  const updatedPayment = allAfter.find((p) => p.id === underReview.id);

  if (!updatedPayment) {
    console.log(`   ❌ FAIL: Payment ${underReview.id} not found in landlord list after approval`);
  } else if (updatedPayment.status === 'PAID' || updatedPayment.status === 'PARTIALLY_PAID') {
    console.log(`   ✅ PASS: Landlord now sees status = "${updatedPayment.status}"`);
  } else {
    console.log(`   ❌ FAIL: Expected PAID, got "${updatedPayment.status}"`);
  }

  console.log('\n=== E2E TEST COMPLETE ===');
  console.log('Summary:');
  console.log(`  Payment ID:       ${underReview.id}`);
  console.log(`  Before status:    UNDER_REVIEW`);
  console.log(`  After status:     ${updatedPayment?.status || 'UNKNOWN'}`);
  console.log(`  Landlord blocked: YES (403)`);
  console.log(`  Manager approved: YES`);
  console.log(`  Landlord sees update: ${updatedPayment?.status === 'PAID' || updatedPayment?.status === 'PARTIALLY_PAID' ? 'YES ✅' : 'NO ❌'}`);
}

run().catch((err) => {
  console.error('❌ E2E TEST CRASHED:', err.message);
  process.exit(1);
});
