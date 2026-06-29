import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const ENV_PATH = path.resolve(__dirname, "../../.env");

function generateSecureKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

function rotate() {
  console.log("--- Starting Environment Secrets Rotation ---");

  if (!fs.existsSync(ENV_PATH)) {
    console.error(`Error: .env file not found at ${ENV_PATH}`);
    process.exit(1);
  }

  let content = fs.readFileSync(ENV_PATH, "utf8");

  const newJwtSecret = generateSecureKey();
  const newCookieSecret = generateSecureKey();
  const newAdminKey = generateSecureKey();

  const keysToRotate = [
    { name: "JWT_SECRET", value: newJwtSecret },
    { name: "COOKIE_SECRET", value: newCookieSecret },
    { name: "ADMIN_SECURITY_KEY", value: newAdminKey },
  ];

  keysToRotate.forEach((key) => {
    const regex = new RegExp(`^(${key.name}\\s*=\\s*["']?)[^"'\n]*([\x22\x27]?)`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `$1${key.value}$2`);
      console.log(`Updated ${key.name} successfully.`);
    } else {
      // Append if it doesn't exist
      content += `\n${key.name}="${key.value}"`;
      console.log(`Added and set ${key.name}.`);
    }
  });

  fs.writeFileSync(ENV_PATH, content, "utf8");
  console.log("\n✅ .env file successfully updated with secure rotated keys.");
}

try {
  rotate();
} catch (error: any) {
  console.error("Failed to rotate secrets:", error.message || error);
  process.exit(1);
}
