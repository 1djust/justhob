import { chromium } from 'playwright';

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  console.log("Navigating to http://localhost:3000/login");
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  
  console.log("Filling in credentials...");
  await page.fill('input[type="email"]', 'manager@justhob.com');
  await page.fill('input[type="password"]', 'Test1234!');
  
  console.log("Clicking Sign In...");
  await page.click('button[type="submit"]');
  
  console.log("Form submitted. Waiting for 5 seconds to observe behavior...");
  await page.waitForTimeout(5000);
  
  console.log("Current URL:", page.url());
  
  const content = await page.content();
  if (content.includes("Invalid login credentials")) {
    console.log("ERROR FOUND: Invalid login credentials text is visible on the page.");
  } else if (content.includes("Failed to login")) {
    console.log("ERROR FOUND: Failed to login text is visible on the page.");
  } else if (page.url().includes('/dashboard')) {
    console.log("SUCCESS: Redirected to dashboard.");
  } else {
    console.log("UNKNOWN STATE: Did not redirect to dashboard, but no obvious error text was found.");
  }
  
  await browser.close();
})().catch(console.error);
