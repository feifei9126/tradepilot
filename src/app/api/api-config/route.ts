import { z } from "zod";
import {
  configAccess,
  mutationOrigin,
  boundedJson,
} from "@/lib/api-config/access";
import {
  configSchema,
  redactConfig,
  SECRET_FIELDS,
} from "@/lib/api-config/schema";
import { configStore, ConfigConflict } from "@/lib/api-config/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
export async function GET() {
  const denied = await configAccess(true);
  if (denied) return denied;
  try {
    const c = configStore().read();
    return Response.json(redactConfig(c.config, c.revision), { headers });
  } catch {
    return Response.json(
      { error: "API 配置读取失败，请检查加密密钥及数据卷权限" },
      { status: 503, headers },
    );
  }
}
export async function PUT(request: Request) {
  const denied = (await configAccess(true)) || mutationOrigin(request);
  if (denied) return denied;
  try {
    const input = z
      .object({
        config: configSchema,
        revision: z.number().int().min(0),
        clearSecrets: z.array(z.enum(SECRET_FIELDS)).default([]),
      })
      .strict()
      .parse(await boundedJson(request));
    const saved = configStore().save(
      input.config,
      input.revision,
      input.clearSecrets,
    );
    return Response.json(redactConfig(saved.config, saved.revision), {
      headers,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("；")
            : error instanceof Error
              ? error.message
              : "保存失败",
      },
      { status: error instanceof ConfigConflict ? 409 : 400, headers },
    );
  }
}
