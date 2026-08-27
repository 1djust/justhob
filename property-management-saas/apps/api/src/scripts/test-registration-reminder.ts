import "dotenv/config";
import {
  buildRegistrationReminderEmail,
  processRegistrationReminders,
} from "../cron/registration-reminder";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 TESTING REGISTRATION FOLLOW-UP EMAIL SYSTEM");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // --- Test 1: Stage 1 Email Template Structure ---
  console.log("\n[1] Testing Stage 1 Template Rendering...");
  const stage1Email = buildRegistrationReminderEmail({
    email: "test.user@example.com",
    name: "John Doe",
    stage: 1,
    frontendUrl: "https://justhob.vercel.app",
  });

  assert(
    stage1Email.subject.includes("Verify your PropertyStack account"),
    "Stage 1 subject contains 'Verify your PropertyStack account'",
  );
  assert(
    stage1Email.html.includes("John Doe"),
    "Stage 1 HTML includes personalized recipient name",
  );
  assert(
    stage1Email.html.includes("test.user%40example.com") ||
      stage1Email.html.includes("test.user@example.com"),
    "Stage 1 HTML contains encoded registration link with email parameter",
  );
  assert(
    stage1Email.text.includes("/link?action=register"),
    "Stage 1 plain-text fallback contains smart registration link",
  );

  // --- Test 2: Stage 2 Email Template Structure ---
  console.log("\n[2] Testing Stage 2 Template Rendering...");
  const stage2Email = buildRegistrationReminderEmail({
    email: "test.user@example.com",
    name: "Jane Smith",
    stage: 2,
    frontendUrl: "https://justhob.vercel.app",
  });

  assert(
    stage2Email.subject.includes("Finish setting up your PropertyStack account"),
    "Stage 2 subject contains 'Finish setting up your PropertyStack account'",
  );
  assert(
    stage2Email.html.includes("Jane Smith"),
    "Stage 2 HTML includes personalized recipient name",
  );
  assert(
    stage2Email.html.includes("Quick & Secure Setup"),
    "Stage 2 HTML includes setup callout",
  );

  // --- Test 3: Fallback when user name is missing ---
  console.log("\n[3] Testing Name Fallback Handling...");
  const fallbackEmail = buildRegistrationReminderEmail({
    email: "noname@example.com",
    stage: 1,
    frontendUrl: "https://justhob.vercel.app",
  });
  assert(
    fallbackEmail.text.includes("Hi there"),
    "Fallback greeting uses 'Hi there' when name is undefined",
  );

  // --- Test 4: Live Dry-Run Scan against Supabase ---
  console.log("\n[4] Testing Live Dry-Run Scan against Supabase Auth...");
  try {
    const dryRunResult = await processRegistrationReminders({
      dryRun: true,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    assert(
      typeof dryRunResult.totalUnconfirmedEvaluated === "number",
      `Queried unconfirmed users successfully (found ${dryRunResult.totalUnconfirmedEvaluated})`,
    );
    assert(
      dryRunResult.errors.length === 0,
      `Dry-run executed with 0 errors`,
    );
  } catch (err) {
    assert(false, `Dry-run crashed: ${(err as Error).message}`);
  }

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
