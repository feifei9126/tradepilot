import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/validation";

interface EmailAccountDraft {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  createdAt: string;
}

const accounts: EmailAccountDraft[] = [];
function validPort(value: unknown, fallback: number) {
  const port = value === undefined || value === "" ? fallback : Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
}

function validHost(value: string) {
  return value.length <= 253 && !/\s|\/|^https?:/i.test(value);
}

export async function GET() {
  return NextResponse.json({ accounts, mode: "configuration-draft" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const imapHost =
    typeof body.imapHost === "string" ? body.imapHost.trim() : "";
  const smtpHost =
    typeof body.smtpHost === "string" ? body.smtpHost.trim() : "";
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const imapPort = validPort(body.imapPort, 993);
  const smtpPort = validPort(body.smtpPort, 465);
  if (!name || !email || !imapHost || !smtpHost) {
    return NextResponse.json(
      { error: "显示名称、邮箱和服务器地址必填" },
      { status: 400 },
    );
  }
  if (
    name.length > 100 ||
    username.length > 320 ||
    !isValidEmail(email) ||
    !validHost(imapHost) ||
    !validHost(smtpHost) ||
    imapPort === null ||
    smtpPort === null
  ) {
    return NextResponse.json(
      { error: "邮箱、服务器地址或端口格式无效" },
      { status: 400 },
    );
  }
  if (accounts.some((account) => account.email === email)) {
    return NextResponse.json({ error: "该邮箱参数已经保存" }, { status: 409 });
  }
  const account: EmailAccountDraft = {
    id: crypto.randomUUID(),
    name,
    email,
    imapHost,
    imapPort,
    smtpHost,
    smtpPort,
    username: username || email,
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  return NextResponse.json({ ok: true, account, mode: "configuration-draft" });
}
