import { transaction, query } from "@/db";
import { encryptTenantSecret, decryptTenantSecret } from "@/lib/tenant-secret";
import { accountSecrets } from "./accounts";
import { ChannelError, type ChannelAccount } from "./types";

export class ProviderError extends ChannelError {
  constructor(
    message: string,
    public code: string,
    public uncertain = false,
  ) {
    super(message, 502);
  }
}
async function providerRequest(
  url: string,
  init: RequestInit,
  channel: string,
) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ProviderError(
      `${channel} 请求超时或网络中断，请核实平台结果`,
      "network",
      true,
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    throw new ProviderError(
      `${channel} 返回了无法识别的响应`,
      "invalid_response",
      true,
    );
  }
  const error =
    body.error && typeof body.error === "object"
      ? (body.error as Record<string, unknown>)
      : {};
  const code =
    typeof body.errcode === "number"
      ? body.errcode
      : typeof error.code === "number"
        ? error.code
        : undefined;
  if (!response.ok || (code !== undefined && code !== 0)) {
    const label =
      code === 45015 || code === 131047
        ? "客户服务回复窗口已关闭"
        : code === 40164
          ? "请在微信后台配置服务器出口 IP 白名单"
          : code === 40001 || code === 40125 || code === 190
            ? "接入凭据已失效，请更新配置"
            : "平台拒绝了请求，请检查权限和账号状态";
    throw new ProviderError(
      `${channel}：${label}（${code ?? response.status}）`,
      String(code ?? response.status),
      response.status >= 500,
    );
  }
  return body;
}
export async function wechatAccessToken(account: ChannelAccount) {
  // Stable token refresh is serialized across replicas, and never returned to the UI.
  return transaction(async (client) => {
    const result = await client.query(
      "SELECT * FROM messaging_accounts WHERE id=$1 AND company_id=$2 FOR UPDATE",
      [account.id, account.company_id],
    );
    const row = result.rows[0] as ChannelAccount & {
      access_token_ciphertext?: string;
      access_token_expires_at?: string;
    };
    if (!row?.enabled) throw new ChannelError("消息渠道已停用", 409);
    if (
      row.access_token_ciphertext &&
      new Date(row.access_token_expires_at || 0).getTime() >
        Date.now() + 120_000
    )
      return decryptTenantSecret(
        row.access_token_ciphertext,
        `messaging-token:${account.id}`,
        account.company_id,
      );
    const secrets = accountSecrets(row);
    const body = await providerRequest(
      "https://api.weixin.qq.com/cgi-bin/stable_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credential",
          appid: row.config.appId,
          secret: secrets.appSecret,
          force_refresh: false,
        }),
      },
      "微信",
    );
    if (
      typeof body.access_token !== "string" ||
      typeof body.expires_in !== "number" ||
      body.expires_in < 120
    )
      throw new ProviderError(
        "微信未返回有效访问凭据",
        "invalid_response",
        true,
      );
    await client.query(
      "UPDATE messaging_accounts SET access_token_ciphertext=$3,access_token_expires_at=$4 WHERE id=$1 AND company_id=$2",
      [
        account.id,
        account.company_id,
        encryptTenantSecret(
          body.access_token,
          `messaging-token:${account.id}`,
          account.company_id,
        ),
        new Date(Date.now() + Math.min(body.expires_in, 7200) * 1000),
      ],
    );
    return body.access_token;
  });
}
export async function sendProviderText(
  account: ChannelAccount,
  peerId: string,
  content: string,
): Promise<string | null> {
  if (!account.enabled) throw new ChannelError("消息渠道已停用", 409);
  if (account.channel === "wechat") {
    const token = await wechatAccessToken(account);
    await providerRequest(
      `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touser: peerId,
          msgtype: "text",
          text: { content },
        }),
      },
      "微信",
    );
    return null; // WeChat客服 sends acknowledge acceptance, but have no message id/read receipt.
  }
  const body = await providerRequest(
    `https://graph.facebook.com/${account.config.apiVersion}/${account.config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accountSecrets(account).accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: peerId,
        type: "text",
        text: { preview_url: false, body: content },
      }),
    },
    "WhatsApp",
  );
  const id = Array.isArray(body.messages) ? body.messages[0]?.id : undefined;
  if (typeof id !== "string" || !/^[\w.:-]{1,200}$/.test(id))
    throw new ProviderError(
      "WhatsApp 未返回消息标识，请核实平台结果",
      "invalid_response",
      true,
    );
  return id;
}
export async function testChannelConnection(account: ChannelAccount) {
  try {
    if (!account.enabled) throw new ChannelError("请先启用消息渠道", 409);
    if (account.channel === "wechat") await wechatAccessToken(account);
    else {
      const body = await providerRequest(
        `https://graph.facebook.com/${account.config.apiVersion}/${account.config.phoneNumberId}?fields=id,display_phone_number,verified_name`,
        {
          headers: {
            Authorization: `Bearer ${accountSecrets(account).accessToken}`,
          },
        },
        "WhatsApp",
      );
      if (body.id !== account.config.phoneNumberId)
        throw new ChannelError("WhatsApp 返回的号码 ID 不匹配", 409);
    }
    await query(
      "UPDATE messaging_accounts SET last_tested_at=now(),last_error=NULL WHERE id=$1 AND company_id=$2",
      [account.id, account.company_id],
    );
    return {
      ok: true,
      message: "API 凭据可用；还需在平台验证回调并发送一条真实消息测试收件箱",
    };
  } catch (error) {
    const safe =
      error instanceof ChannelError ? error.message : "消息渠道测试失败";
    await query(
      "UPDATE messaging_accounts SET last_tested_at=now(),last_error=$3 WHERE id=$1 AND company_id=$2",
      [account.id, account.company_id, safe.slice(0, 250)],
    );
    throw error;
  }
}
