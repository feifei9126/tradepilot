import { BusinessError } from "@/lib/business/errors";

const CONFIRMATION_WINDOW_MS = 15 * 60_000;
const encoder = new TextEncoder();

export interface NormalizedFirecrawlPreview {
  sourceUrl: string;
  name: string;
  modelNo?: string;
  costPrice?: number;
  unit: string;
  category?: string;
  description?: string;
  media: {
    type: "image" | "video";
    url: string;
    title?: string;
  }[];
}

interface ConfirmationPayload {
  issuedAt: number;
  sourceUrl: string;
  normalizedPreviewHash: string;
}

function stringValue(value: unknown, fallback = "", maxLength = 20_000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000_000_000
    ? value
    : undefined;
}

function toHex(value: Uint8Array) {
  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(value: string) {
  if (!value || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    throw new BusinessError(
      "VALIDATION_ERROR",
      "抓取预览确认令牌无效",
      400,
    );
  }
  const pairs = value.match(/.{2}/g) || [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function digest(value: string) {
  return toHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
  );
}

export function firecrawlConfirmationSecret() {
  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "tradepilot-development-firecrawl-confirmation";
  }
  throw new BusinessError(
    "DATABASE_NOT_CONFIGURED",
    "生产环境必须配置 AUTH_SECRET",
    503,
  );
}

export function normalizeConfirmationPreview(
  value: unknown,
): NormalizedFirecrawlPreview {
  const preview =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const media: NormalizedFirecrawlPreview["media"] = Array.isArray(
    preview.media,
  )
    ? preview.media.flatMap<NormalizedFirecrawlPreview["media"][number]>((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const type =
          record.type === "image" || record.type === "video"
            ? record.type
            : null;
        const url = stringValue(record.url, "", 2_048);
        if (!type || !url) return [];
        return [
          {
            type,
            url,
            title: stringValue(record.title, "", 200) || undefined,
          },
        ];
      })
    : [];
  return {
    sourceUrl: stringValue(preview.sourceUrl, "", 2_048),
    name: stringValue(preview.name, "未命名产品", 200),
    modelNo: stringValue(preview.modelNo, "", 100) || undefined,
    costPrice: numberValue(preview.costPrice),
    unit: stringValue(preview.unit, "件", 30) || "件",
    category: stringValue(preview.category, "", 100) || undefined,
    description: stringValue(preview.description, "", 20_000) || undefined,
    media: media.slice(0, 20),
  };
}

async function previewHash(preview: unknown) {
  return digest(JSON.stringify(normalizeConfirmationPreview(preview)));
}

export async function signFirecrawlPreview(
  preview: unknown,
  secret: string,
  issuedAt = Date.now(),
) {
  const normalized = normalizeConfirmationPreview(preview);
  if (!normalized.sourceUrl) {
    throw new BusinessError(
      "VALIDATION_ERROR",
      "抓取预览缺少来源链接",
      400,
    );
  }
  const payload: ConfirmationPayload = {
    issuedAt,
    sourceUrl: normalized.sourceUrl,
    normalizedPreviewHash: await previewHash(normalized),
  };
  const encodedPayload = toHex(encoder.encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await hmac(encodedPayload, secret)}`;
}

export async function verifyFirecrawlPreview(
  preview: unknown,
  token: string,
  secret: string,
  now = Date.now(),
) {
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) {
    throw new BusinessError(
      "VALIDATION_ERROR",
      "抓取预览确认令牌无效",
      400,
    );
  }
  const expectedSignature = await hmac(encodedPayload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new BusinessError(
      "VALIDATION_ERROR",
      "抓取预览确认令牌无效",
      400,
    );
  }

  let payload: ConfirmationPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromHex(encodedPayload)));
  } catch (error) {
    if (error instanceof BusinessError) throw error;
    throw new BusinessError(
      "VALIDATION_ERROR",
      "抓取预览确认令牌无效",
      400,
    );
  }
  if (
    !Number.isFinite(payload.issuedAt) ||
    payload.issuedAt > now + 60_000 ||
    now - payload.issuedAt > CONFIRMATION_WINDOW_MS
  ) {
    throw new BusinessError(
      "VALIDATION_ERROR",
      "抓取预览已过期，请重新抓取",
      400,
    );
  }
  const normalized = normalizeConfirmationPreview(preview);
  const hash = await previewHash(normalized);
  if (
    payload.sourceUrl !== normalized.sourceUrl ||
    !constantTimeEqual(payload.normalizedPreviewHash, hash)
  ) {
    throw new BusinessError(
      "VALIDATION_ERROR",
      "抓取预览内容已被修改，请重新抓取",
      400,
    );
  }
  return normalized;
}
