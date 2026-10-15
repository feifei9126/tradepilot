import { configureTestDatabase } from "./test-database";
import { reserveLoginAttempt } from "../../src/lib/login-security";
import { closeDbPool } from "../../src/db";

async function main() {
  configureTestDatabase();
  const [email, ip, count] = process.argv.slice(2);
  try {
    const attempts = await Promise.all(Array.from({ length: Number(count) }, () =>
      reserveLoginAttempt(email, new Request("http://localhost/api/auth/callback/credentials", {
        headers: { "x-real-ip": ip, "x-tradepilot-proxy-auth": process.env.TRADEPILOT_PROXY_AUTH_SECRET! },
      }))));
    console.log(JSON.stringify(attempts));
  } finally {
    await closeDbPool();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
