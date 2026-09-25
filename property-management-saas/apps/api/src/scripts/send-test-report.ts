/**
 * send-test-report.ts — Emails the latest integration test report to ADMIN_EMAIL
 *
 * This script reads the most recent JSON report from
 * propertystack_mobile/integration_test/reports/ and sends a comprehensive,
 * beautifully styled HTML email with full details of:
 *   - Executive summary & pass rate
 *   - Module breakdown
 *   - Failed tests with root cause, location trace, and "How to Fix" guide
 *   - Passed tests inventory with test names, IDs, and execution durations
 *   - Skipped tests (if any)
 *
 * Usage:
 *   cd property-management-saas/apps/api
 *   npx tsx src/scripts/send-test-report.ts
 *
 * Or after running integration tests:
 *   cd propertystack_mobile && ./integration_test.sh tenants
 */

import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables from apps/api/.env and root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { sendEmail } from "../lib/mailer";
import { renderEmailLayout } from "../lib/email-template";

interface TestResult {
  id: string;
  module: string;
  name: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  reason?: string | null;
  errorDetails?: string | null;
  stackTrace?: string | null;
  remediation?: string | null;
  durationMs: number;
}

interface TestReport {
  timestamp: string;
  device: string;
  durationMs: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: string;
  };
  results: TestResult[];
}

function findLatestReport(): string | null {
  const candidateDirs = [
    path.resolve(__dirname, "../../../../../propertystack_mobile/integration_test/reports"),
    path.resolve(__dirname, "../../../../propertystack_mobile/integration_test/reports"),
    path.resolve(process.cwd(), "../../propertystack_mobile/integration_test/reports"),
    path.resolve(process.cwd(), "../propertystack_mobile/integration_test/reports"),
    path.resolve(process.cwd(), "propertystack_mobile/integration_test/reports"),
    "/home/djust/projects/justhub/propertystack_mobile/integration_test/reports",
  ];

  let reportsDir: string | null = null;
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      reportsDir = dir;
      break;
    }
  }

  if (!reportsDir) {
    console.error(`[TestReport] Reports directory not found in candidate paths:`);
    candidateDirs.forEach((d) => console.error(`  - ${d}`));
    return null;
  }

  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error(`[TestReport] No JSON reports found in: ${reportsDir}`);
    return null;
  }

  return path.join(reportsDir, files[0]);
}

/**
 * Sanitizes JSON content by stripping Android logcat prefixes like "I/flutter ( 7740): "
 */
function cleanJsonString(raw: string): string {
  const cleanedLines = raw
    .split("\n")
    .map((line) => line.replace(/^.*?I\/flutter\s*\(\s*\d+\s*\):\s*/, "").replace(/^.*?###LINE###/, ""))
    .join("\n")
    .trim();

  // Find start and end of JSON object if wrapped in text
  const startIdx = cleanedLines.indexOf("{");
  const endIdx = cleanedLines.lastIndexOf("}");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return cleanedLines.substring(startIdx, endIdx + 1);
  }

  return cleanedLines;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

function buildReportHtml(report: TestReport): string {
  const date = new Date(report.timestamp).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const durationMin = Math.floor(report.durationMs / 60000);
  const durationSec = Math.floor((report.durationMs % 60000) / 1000);

  const passColor = "#10B981";
  const failColor = "#EF4444";
  const skipColor = "#F59E0B";
  const primaryBlue = "#2563EB";
  const allPassed = report.summary.failed === 0;

  // Group by module
  const modules: Record<string, TestResult[]> = {};
  for (const r of report.results) {
    if (!modules[r.module]) modules[r.module] = [];
    modules[r.module].push(r);
  }

  // Module summary table
  const moduleRows = Object.entries(modules)
    .map(([mod, results]) => {
      const passed = results.filter((r) => r.status === "PASSED").length;
      const total = results.length;
      const icon = passed === total ? "✅" : "⚠️";
      const color = passed === total ? passColor : failColor;
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      return `<tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; font-size: 14px; font-weight: 600; color: #1E293B;">
          ${icon} ${mod}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #64748B;">
          ${total} test${total > 1 ? "s" : ""}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 700; color: ${color}; font-size: 14px;">
          ${passed} / ${total} (${percentage}%)
        </td>
      </tr>`;
    })
    .join("");

  // Detailed Failed tests
  const failedTests = report.results.filter((r) => r.status === "FAILED");
  const failedSection =
    failedTests.length > 0
      ? `
    <div style="margin-top: 32px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #991B1B; margin: 0;">
          ❌ Failed Tests Diagnostic Breakdown (${failedTests.length})
        </h3>
      </div>
      <p style="font-size: 13px; color: #64748B; margin: 0 0 16px 0;">
        Detailed failure logs with location traces and recommended fix strategies.
      </p>

      ${failedTests
        .map(
          (t) => `
        <div style="background: #FFFFFF; border: 1px solid #FCA5A5; border-left: 5px solid #EF4444; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="margin-bottom: 8px;">
            <span style="background: #FEE2E2; color: #991B1B; font-weight: 700; font-size: 12px; padding: 3px 8px; border-radius: 4px; display: inline-block;">
              ${t.module.toUpperCase()} &bull; ${t.id}
            </span>
            <strong style="font-size: 15px; color: #0F172A; margin-left: 8px;">${t.name}</strong>
            <span style="float: right; font-size: 12px; color: #94A3B8;">${formatDuration(t.durationMs)}</span>
          </div>

          <div style="margin-top: 10px; padding: 10px 12px; background: #FEF2F2; border-radius: 6px; font-size: 13px; color: #7F1D1D; font-family: monospace; word-break: break-word;">
            <strong>Error:</strong> ${t.reason || "Assertion or execution failure"}
          </div>

          ${
            t.remediation
              ? `
          <div style="margin-top: 10px; padding: 10px 12px; background: #F0FDF4; border-radius: 6px; border-left: 3px solid #22C55E; font-size: 13px; color: #14532D;">
            <strong>💡 How to Fix:</strong> ${t.remediation}
          </div>`
              : ""
          }

          ${
            t.stackTrace
              ? `
          <div style="margin-top: 10px;">
            <div style="font-size: 12px; font-weight: 600; color: #64748B; margin-bottom: 4px;">Location Trace:</div>
            <pre style="background: #0F172A; color: #E2E8F0; padding: 10px; border-radius: 6px; font-size: 11px; overflow-x: auto; margin: 0; line-height: 1.5;">${t.stackTrace}</pre>
          </div>`
              : ""
          }

          <div style="margin-top: 10px; font-size: 12px; color: #64748B;">
            <strong>Re-test command:</strong> <code style="background: #F1F5F9; padding: 2px 6px; border-radius: 4px; color: #2563EB;">./integration_test.sh ${t.module.toLowerCase()}</code>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>`
      : "";

  // Detailed Passed tests inventory
  const passedTests = report.results.filter((r) => r.status === "PASSED");
  const passedSection = `
    <div style="margin-top: 32px;">
      <h3 style="font-size: 16px; font-weight: 700; color: #065F46; margin: 0 0 12px 0;">
        ✅ Passed Tests Inventory (${passedTests.length} of ${report.summary.total})
      </h3>
      <p style="font-size: 13px; color: #64748B; margin: 0 0 14px 0;">
        Comprehensive breakdown of all test cases that executed successfully.
      </p>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background: #FFFFFF;">
        <thead>
          <tr style="background: #F8FAFC; border-bottom: 2px solid #E2E8F0;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; width: 60px;">ID</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; width: 100px;">Module</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">Test Description / Verified Feature</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 700; color: #475569; width: 80px;">Time</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; width: 80px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${passedTests
            .map(
              (t) => `
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; font-weight: 700; color: #0F172A; font-family: monospace;">
                ${t.id}
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; color: #475569; font-weight: 500;">
                ${t.module}
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 13px; color: #1E293B;">
                ${t.name}
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right; color: #64748B; font-family: monospace;">
                ${formatDuration(t.durationMs)}
              </td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9; text-align: center;">
                <span style="background: #ECFDF5; color: #059669; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1px solid #A7F3D0; display: inline-block;">
                  PASSED
                </span>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  // Detailed Skipped tests
  const skippedTests = report.results.filter((r) => r.status === "SKIPPED");
  const skippedSection =
    skippedTests.length > 0
      ? `
    <div style="margin-top: 32px;">
      <h3 style="font-size: 16px; font-weight: 700; color: #92400E; margin: 0 0 12px 0;">
        ⚠️ Skipped Tests (${skippedTests.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #FDE68A; border-radius: 8px; background: #FFFBEB;">
        <thead>
          <tr style="background: #FEF3C7;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #92400E;">ID</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #92400E;">Module</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #92400E;">Test Name</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #92400E;">Reason</th>
          </tr>
        </thead>
        <tbody>
          ${skippedTests
            .map(
              (t) => `
            <tr>
              <td style="padding: 10px 12px; border-top: 1px solid #FDE68A; font-size: 12px; font-weight: 700;">${t.id}</td>
              <td style="padding: 10px 12px; border-top: 1px solid #FDE68A; font-size: 12px;">${t.module}</td>
              <td style="padding: 10px 12px; border-top: 1px solid #FDE68A; font-size: 13px;">${t.name}</td>
              <td style="padding: 10px 12px; border-top: 1px solid #FDE68A; font-size: 12px; color: #B45309;">${t.reason || "Skipped by filter"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>`
      : "";

  const bodyHtml = `
    <!-- Top Pass Rate Banner -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: ${allPassed ? "#ECFDF5" : "#FEF2F2"}; border: 2px solid ${allPassed ? passColor : failColor}; border-radius: 12px; padding: 20px 48px;">
        <div style="font-size: 48px; font-weight: 800; color: ${allPassed ? passColor : failColor}; letter-spacing: -1px;">
          ${report.summary.passRate}
        </div>
        <div style="font-size: 13px; font-weight: 600; color: #64748B; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
          Overall Suite Pass Rate
        </div>
      </div>
    </div>

    <!-- 4-Stat Metric Cards -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
      <tr>
        <td style="text-align: center; padding: 16px; border-right: 1px solid #E2E8F0;">
          <div style="font-size: 26px; font-weight: 800; color: ${passColor};">${report.summary.passed}</div>
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Passed</div>
        </td>
        <td style="text-align: center; padding: 16px; border-right: 1px solid #E2E8F0;">
          <div style="font-size: 26px; font-weight: 800; color: ${failColor};">${report.summary.failed}</div>
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Failed</div>
        </td>
        <td style="text-align: center; padding: 16px; border-right: 1px solid #E2E8F0;">
          <div style="font-size: 26px; font-weight: 800; color: ${skipColor};">${report.summary.skipped}</div>
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Skipped</div>
        </td>
        <td style="text-align: center; padding: 16px;">
          <div style="font-size: 26px; font-weight: 800; color: ${primaryBlue};">${report.summary.total}</div>
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Executed</div>
        </td>
      </tr>
    </table>

    <!-- Environment & Execution Metadata Box -->
    <div style="background: #F1F5F9; border-radius: 8px; padding: 12px 16px; margin-bottom: 28px; font-size: 13px; color: #475569; border: 1px solid #E2E8F0;">
      📱 Target Device: <strong>${report.device}</strong> &nbsp;&bull;&nbsp;
      🕐 Total Duration: <strong>${durationMin}m ${durationSec}s</strong> &nbsp;&bull;&nbsp;
      📅 Executed: <strong>${date}</strong>
    </div>

    <!-- Module Summary Breakdown -->
    <h3 style="font-size: 16px; font-weight: 700; color: #1E293B; margin: 0 0 12px 0;">Module Summary Breakdown</h3>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; background: #FFFFFF;">
      <thead>
        <tr style="background: #F8FAFC;">
          <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">Module</th>
          <th style="padding: 10px 14px; text-align: center; font-size: 12px; font-weight: 700; color: #475569;">Tests Executed</th>
          <th style="padding: 10px 14px; text-align: center; font-size: 12px; font-weight: 700; color: #475569;">Result / Pass Rate</th>
        </tr>
      </thead>
      <tbody>
        ${moduleRows}
      </tbody>
    </table>

    <!-- Failed Tests Section -->
    ${failedSection}

    <!-- Passed Tests Section -->
    ${passedSection}

    <!-- Skipped Tests Section -->
    ${skippedSection}

    <!-- Troubleshooting Box -->
    <div style="margin-top: 32px; padding: 16px; background: #EFF6FF; border-radius: 8px; border-left: 4px solid #2563EB;">
      <p style="margin: 0; font-size: 13px; color: #1E40AF; line-height: 1.6;">
        <strong>🚀 Quick Test Execution Commands:</strong><br/>
        &bull; Run Tenants flow (T1-T5): <code>./integration_test.sh tenants</code><br/>
        &bull; Run Owners flow (O1-O6): <code>./integration_test.sh owners</code><br/>
        &bull; Run Full Suite (All 64 tests): <code>./integration_test.sh</code><br/>
        &bull; View Raw Report Archive: <code>propertystack_mobile/integration_test/reports/</code>
      </p>
    </div>
  `;

  return bodyHtml;
}

async function main(): Promise<void> {
  const adminEmail =
    process.env.ADMIN_EMAIL || "propertystackapp@gmail.com";

  console.log("[TestReport] Finding latest report...");
  const reportPath = findLatestReport();
  if (!reportPath) {
    process.exit(1);
  }

  console.log(`[TestReport] Reading: ${reportPath}`);
  const raw = fs.readFileSync(reportPath, "utf-8");
  const cleanedJson = cleanJsonString(raw);
  
  let report: TestReport;
  try {
    report = JSON.parse(cleanedJson);
  } catch (parseErr) {
    console.error("[TestReport] Error parsing cleaned JSON:", parseErr);
    console.error("[TestReport] Raw preview:", raw.substring(0, 300));
    process.exit(1);
  }

  const allPassed = report.summary.failed === 0;
  const subject = allPassed
    ? `✅ Mobile Tests PASSED — ${report.summary.passRate} (${report.summary.passed}/${report.summary.total})`
    : `⚠️ Mobile Tests: ${report.summary.failed} FAILED — ${report.summary.passRate} (${report.summary.passed}/${report.summary.total})`;

  const bodyHtml = buildReportHtml(report);
  const finalHtml = renderEmailLayout({
    title: subject,
    badge: "QA TEST REPORT",
    bodyHtml,
    recipientEmail: adminEmail,
  });

  const plainText = `PropertyStack Mobile Test Report
Pass Rate: ${report.summary.passRate}
Passed: ${report.summary.passed}, Failed: ${report.summary.failed}, Skipped: ${report.summary.skipped}
Total: ${report.summary.total}
Device: ${report.device}
Timestamp: ${report.timestamp}`;

  console.log(`[TestReport] Sending detailed report to ${adminEmail}...`);
  const result = await sendEmail(adminEmail, subject, plainText, finalHtml);
  console.log(
    `[TestReport] ✅ Report sent via ${(result as { provider?: string }).provider || "mailer"} | ID: ${(result as { messageId?: string }).messageId}`,
  );
}

main().catch((err) => {
  console.error("[TestReport] Failed to send:", err);
  process.exit(1);
});
