import crypto from "node:crypto";

import {
  hashPassword,
  isMainModule,
  normalizeEmail,
  openSql,
  requireDatabaseUrl,
  safeErrorMessage,
} from "./common.mjs";

function adminSlug(email) {
  return `admin-${crypto.createHash("sha256").update(email).digest("hex").slice(0, 16)}`;
}

export async function bootstrapAdmin({
  databaseUrl = requireDatabaseUrl(),
  email = process.env.TRADEPILOT_ADMIN_EMAIL,
  password = process.env.TRADEPILOT_ADMIN_PASSWORD,
  companyName = "TradePilot Admin",
  userName = "Admin",
  log = console.log,
} = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("TRADEPILOT_ADMIN_EMAIL is invalid");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("TRADEPILOT_ADMIN_PASSWORD must contain 8-128 characters");
  }

  const sql = openSql(databaseUrl);
  try {
    const result = await sql.begin(async (transaction) => {
      const passwordHash = hashPassword(password);
      const [existing] = await transaction`
        SELECT id, company_id
        FROM users
        WHERE lower(email) = ${normalizedEmail}
        FOR UPDATE
      `;

      if (existing) {
        const [user] = await transaction`
          UPDATE users
          SET email = ${normalizedEmail},
              name = ${userName},
              role = 'owner',
              is_active = true,
              settings = COALESCE(settings, '{}'::jsonb) || ${transaction.json({ passwordHash })}
          WHERE id = ${existing.id}
          RETURNING id, company_id
        `;
        return { userId: user.id, companyId: user.company_id };
      }

      const [company] = await transaction`
        INSERT INTO companies (name, slug)
        VALUES (${companyName}, ${adminSlug(normalizedEmail)})
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      const [user] = await transaction`
        INSERT INTO users (company_id, email, name, role, settings, is_active)
        VALUES (
          ${company.id},
          ${normalizedEmail},
          ${userName},
          'owner',
          ${transaction.json({ passwordHash })},
          true
        )
        RETURNING id, company_id
      `;
      return { userId: user.id, companyId: user.company_id };
    });

    log(`管理员账号已初始化: ${normalizedEmail}`);
    return { ...result, email: normalizedEmail };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (isMainModule(import.meta.url)) {
  bootstrapAdmin().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}
