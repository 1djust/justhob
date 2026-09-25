import { _android as android } from "playwright";

/**
 * Direct Android Device Automation via ADB.
 * Drives the Google Chrome browser inside the running emulator-5554 in real-time.
 */
async function runLiveAndroidTest() {
  console.log("Connecting to Android Emulator via ADB...");
  const [device] = await android.devices();

  if (!device) {
    console.error("❌ No Android emulator or device found. Ensure adb devices shows emulator-5554.");
    process.exit(1);
  }

  console.log(`📱 Connected to Android Device: ${device.model() || "emulator-5554"} (${device.serial()})`);

  // Ensure ports are reversed
  console.log("🔌 Setting up port forwarding (3000 -> 3000, 3001 -> 3001)...");
  try {
    await device.shell("reverse tcp:3000 tcp:3000");
    await device.shell("reverse tcp:3001 tcp:3001");
  } catch (e) {
    // Ignore if already set
  }

  // Launch Google Chrome inside the Android emulator
  console.log("🌐 Launching Google Chrome on Android Emulator...");
  const context = await device.launchBrowser({
    command: "com.android.chrome",
  } as Record<string, unknown>);

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    // 1. Navigate to login
    console.log("1️⃣ Navigating to Login page (http://localhost:3000/login)...");
    await page.goto("http://localhost:3000/login");
    await page.waitForTimeout(2000);

    // 2. Perform Login
    console.log("2️⃣ Filling credentials for manager_pro@justhob.com...");
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill("manager_pro@justhob.com");

    const passwordInput = page.getByLabel(/password/i);
    await passwordInput.fill("Test1234!");

    console.log("3️⃣ Clicking Sign In button...");
    await page.getByRole("button", { name: /sign in|login|log in/i }).click();

    // 3. Wait for Dashboard
    console.log("4️⃣ Waiting for Dashboard to load...");
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    console.log("✅ Successfully logged in and navigated to Dashboard!");
    await page.waitForTimeout(3000);

    // 4. Navigate to Properties
    console.log("5️⃣ Navigating to Properties tab...");
    const propertiesBtn = page.getByRole("button", { name: /properties/i });
    if (await propertiesBtn.isVisible()) {
      await propertiesBtn.click();
      console.log("✅ Properties view active!");
      await page.waitForTimeout(3000);
    }

    // 5. Navigate to Tenants
    console.log("6️⃣ Navigating to Tenants tab...");
    const tenantsBtn = page.getByRole("button", { name: /tenants/i });
    if (await tenantsBtn.isVisible()) {
      await tenantsBtn.click();
      console.log("✅ Tenants view active!");
      await page.waitForTimeout(3000);
    }

    // 6. Navigate to Payments
    console.log("7️⃣ Navigating to Payments tab...");
    const paymentsBtn = page.getByRole("button", { name: /payments/i });
    if (await paymentsBtn.isVisible()) {
      await paymentsBtn.click();
      console.log("✅ Payments view active!");
      await page.waitForTimeout(3000);
    }

    // 7. Navigate to Maintenance
    console.log("8️⃣ Navigating to Maintenance tab...");
    const maintBtn = page.getByRole("button", { name: /maintenance/i });
    if (await maintBtn.isVisible()) {
      await maintBtn.click();
      console.log("✅ Maintenance view active!");
      await page.waitForTimeout(3000);
    }

    console.log("\n🎉 LIVE ANDROID EMULATOR TEST COMPLETED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Test error:", error);
  } finally {
    // Keep browser open for 5 seconds so user can see final state
    await page.waitForTimeout(5000);
    await context.close();
    await device.close();
  }
}

runLiveAndroidTest().catch(console.error);
