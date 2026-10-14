"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Loader2,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UsageGuide } from "@/components/usage-guide";
import type {
  PublicChannelAccount,
  MessagingChannel,
} from "@/lib/messaging/types";

type Draft = {
  id: string;
  channel: MessagingChannel;
  name: string;
  appId: string;
  originalId: string;
  phoneNumberId: string;
  wabaId: string;
  apiVersion: string;
  appSecret: string;
  verifyToken: string;
  aesKey: string;
  accessToken: string;
  enabled: boolean;
};
const fresh = (channel: MessagingChannel = "wechat"): Draft => ({
  id: "",
  channel,
  name: "",
  appId: "",
  originalId: "",
  phoneNumberId: "",
  wabaId: "",
  apiVersion: "v24.0",
  appSecret: "",
  verifyToken: "",
  aesKey: "",
  accessToken: "",
  enabled: true,
});
const label = (channel: MessagingChannel) =>
  channel === "wechat" ? "微信服务号" : "WhatsApp";
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN") : "尚未收到";
async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试");
  return data;
}
export function ChannelSettingsPanel() {
  const [accounts, setAccounts] = useState<PublicChannelAccount[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState("");
  const [setup, setSetup] = useState<{
    id: string;
    verifyToken: string;
    aesKey?: string;
  } | null>(null);
  async function load() {
    try {
      const data = await api("/api/channels/accounts");
      setAccounts(data.accounts);
      setCanManage(data.canManage);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "配置加载失败");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void api("/api/channels/accounts")
      .then((data) => {
        if (active) {
          setAccounts(data.accounts);
          setCanManage(data.canManage);
        }
      })
      .catch((error) => {
        if (active)
          setLoadError(error instanceof Error ? error.message : "配置加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function act(key: string, work: () => Promise<void>) {
    setBusy(key);
    try {
      await work();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy("");
    }
  }
  function edit(account: PublicChannelAccount) {
    setSetup(null);
    setDraft({
      ...fresh(account.channel),
      ...account.config,
      id: account.id,
      name: account.name,
      enabled: account.enabled,
    });
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制");
    } catch {
      toast.error("复制失败，请手动选择内容复制");
    }
  }
  const field = (
    key: keyof Draft,
    title: string,
    hint: string,
    type = "text",
    required = false,
  ) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={`channel-${key}`}>{title}</Label>
      <Input
        id={`channel-${key}`}
        type={type}
        value={String(draft?.[key] || "")}
        onChange={(event) =>
          setDraft((current) =>
            current ? { ...current, [key]: event.target.value } : current,
          )
        }
        autoComplete={type === "password" ? "new-password" : "off"}
        required={required}
        maxLength={key === "accessToken" ? 4096 : key === "name" ? 100 : 256}
      />
      <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-primary">
            客户沟通 / 官方渠道
          </p>
          <h1 className="text-2xl font-semibold">消息渠道</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            接收服务号和 WhatsApp 消息，在手机或电脑的同一收件箱里回复。
          </p>
        </div>
        <Button variant="outline" render={<Link href="/app/messages" />}>
          <MessageSquare className="size-4" />
          打开消息收件箱
        </Button>
      </div>
      <UsageGuide
        title="第一次接入？从这里开始"
        description="服务号接收发给公众号的消息；WhatsApp 使用官方 Business Cloud API。"
      >
        <div className="grid gap-6 md:grid-cols-2 text-sm leading-6">
          <div>
            <h2 className="mb-2 font-semibold">微信服务号：五步接入</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                登录微信公众号后台，确认服务号认证和客服接口权限可用。在「设置与开发
                / 基本配置」查看 AppID、AppSecret 和原始 ID。
              </li>
              <li>
                点击下方「添加微信服务号」，填写配置并保存。Token 和
                EncodingAESKey 留空时系统会生成。
              </li>
              <li>
                点击「查看接入参数」，把回调 URL、Token、EncodingAESKey
                复制到公众号「服务器配置」。选择「安全模式（推荐）」和 XML
                格式，提交并启用。
              </li>
              <li>
                把部署服务器的出口 IP 加到公众号 IP 白名单，再在这里点击「测试
                API 凭据」。该测试会检查访问凭据，不发送客户消息。
              </li>
              <li>
                用微信关注服务号并给它发一句话，然后打开收件箱检查接收和回复。公众号后台的登录
                token 不能代替 AppSecret。
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              回复窗口通常为用户互动后的 48
              小时。服务号接入范围是公众号会话，无法读取个人微信聊天。启用服务器配置前先记录现有菜单和自动回复；开发模式会改变这些功能的管理方式。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-semibold">WhatsApp：五步接入</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                在 Meta 开发者后台创建包含 WhatsApp 的应用，并准备 Business
                账号和 Cloud API
                号码。测试账号只能向已添加的测试接收号码发消息。
              </li>
              <li>
                在 API Setup 获取 Phone Number ID、Business Account ID 和 Access
                Token，在应用基本设置获取 App Secret。
              </li>
              <li>
                添加渠道并保存。生产环境使用获授相应 WhatsApp
                权限的正式访问令牌，过期后在这里更新。
              </li>
              <li>
                在 Meta Webhooks 选择 WhatsApp Business Account，填写本页回调
                URL 和验证 Token，验证后订阅 <code>messages</code>
                ；把应用订阅到目标 Business 账号。
              </li>
              <li>
                测试 API 凭据，再用另一个号码向 Cloud API
                号码发消息，检查收件箱及回复回执。
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              普通文字回复限最近一条客户消息后的 24
              小时；超时需要获批模板。本页暂不提供模板群发。媒体目前显示消息类型和说明。
            </p>
          </div>
        </div>
      </UsageGuide>
      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {loadError}
          <Button variant="link" onClick={() => void load()}>
            重新加载
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          正在加载渠道配置…
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">当前工作区的渠道</h2>
            {canManage && (
              <>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    setSetup(null);
                    setDraft(fresh("wechat"));
                  }}
                >
                  <Plus className="size-4" />
                  添加微信服务号
                </Button>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    setSetup(null);
                    setDraft(fresh("whatsapp"));
                  }}
                >
                  <Plus className="size-4" />
                  添加 WhatsApp
                </Button>
              </>
            )}
          </div>
          {!accounts.length && (
            <div className="rounded-2xl border border-dashed bg-background p-8 text-center">
              <MessageSquare className="mx-auto mb-3 size-7 text-primary" />
              <p className="font-medium">还没有配置消息渠道</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {canManage
                  ? "先添加服务号或 WhatsApp 账号，再按上面的步骤配置平台回调。"
                  : "请工作区所有者或管理员添加账号；配置完成后你可以使用消息收件箱。"}
              </p>
            </div>
          )}
          <div className="space-y-4">
            {accounts.map((account) => (
              <section
                className="rounded-2xl border bg-background p-4 sm:p-5"
                key={account.id}
                aria-label={`${account.name}渠道配置`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{account.name}</h3>
                  <Badge variant="outline">{label(account.channel)}</Badge>
                  <Badge variant="outline">
                    {account.enabled ? "已启用" : "已停用"}
                  </Badge>
                  {account.lastVerifiedAt && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <ShieldCheck className="size-3.5" />
                      回调曾通过验证
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <p>平台验证：{time(account.lastVerifiedAt)}</p>
                  <p>最近接收：{time(account.lastReceivedAt)}</p>
                  <p>API 测试：{time(account.lastTestedAt)}</p>
                </div>
                {!account.publicCallbackReady && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    尚未配置可访问的 HTTPS 域名。当前 localhost
                    地址仅用于本地测试；部署后由平台管理员把 AUTH_URL
                    设置为正式站点地址，再复制回调 URL 到微信或 Meta。
                  </p>
                )}
                <div className="mt-3 flex min-w-0 items-center gap-2">
                  <Input
                    aria-label={`${account.name}回调 URL`}
                    readOnly
                    value={account.callbackUrl}
                    className="min-w-0 font-mono text-xs"
                  />
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={!account.publicCallbackReady}
                    aria-label={`复制${account.name}回调 URL`}
                    onClick={() => void copy(account.callbackUrl)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
                {account.lastError && (
                  <p className="mt-3 text-xs text-destructive" role="alert">
                    {account.lastError}
                  </p>
                )}
                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy}
                      onClick={() => edit(account)}
                    >
                      <Settings2 className="size-3.5" />
                      修改配置 / 更新凭据
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy}
                      onClick={() =>
                        void act(`setup:${account.id}`, async () => {
                          if (setup?.id === account.id) {
                            setSetup(null);
                            return;
                          }
                          const data = await api("/api/channels/setup", {
                            accountId: account.id,
                          });
                          setSetup({ id: account.id, ...data });
                        })
                      }
                    >
                      {setup?.id === account.id
                        ? "隐藏接入参数"
                        : "查看接入参数"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy || !account.enabled}
                      onClick={() =>
                        void act(`test:${account.id}`, async () => {
                          try {
                            const data = await api("/api/channels/test", {
                              accountId: account.id,
                            });
                            toast.success(data.message);
                          } finally {
                            await load();
                          }
                        })
                      }
                    >
                      测试 API 凭据
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy}
                      onClick={() =>
                        void act(`toggle:${account.id}`, async () => {
                          await api("/api/channels/accounts", {
                            id: account.id,
                            channel: account.channel,
                            name: account.name,
                            ...account.config,
                            enabled: !account.enabled,
                          });
                          setSetup(null);
                          await load();
                          toast.success(
                            account.enabled ? "渠道已停用" : "渠道已启用",
                          );
                        })
                      }
                    >
                      {account.enabled ? "停用" : "启用"}
                    </Button>
                  </div>
                )}
                {setup?.id === account.id && (
                  <div className="mt-4 space-y-3 rounded-xl bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground">
                      复制到官方平台的服务器配置。更新后旧参数立即失效，请同步更新平台设置。
                    </p>
                    {[
                      ["Token / Verify Token", setup.verifyToken],
                      ...(setup.aesKey
                        ? [["EncodingAESKey", setup.aesKey]]
                        : []),
                    ].map(([title, value]) => (
                      <div className="flex items-end gap-2" key={title}>
                        <div className="min-w-0 flex-1 space-y-1">
                          <Label
                            htmlFor={`setup-${account.id}-${title.split(" ")[0]}`}
                          >
                            {title}
                          </Label>
                          <Input
                            id={`setup-${account.id}-${title.split(" ")[0]}`}
                            type="password"
                            readOnly
                            value={value}
                            className="font-mono text-xs"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`复制${title}`}
                          onClick={() => void copy(value)}
                        >
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {draft && canManage && (
        <section
          className="rounded-2xl border bg-background p-4 sm:p-6"
          aria-label="编辑消息渠道"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              {draft.id ? "修改" : "添加"}
              {label(draft.channel)}
            </h2>
            <Button
              variant="ghost"
              disabled={!!busy}
              onClick={() => {
                setDraft(null);
                setSetup(null);
              }}
            >
              取消
            </Button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act("save", async () => {
                const data = await api("/api/channels/accounts", draft);
                setDraft(null);
                setSetup(null);
                await load();
                toast.success("配置已保存，请继续在官方平台配置回调");
                const parameters = await api("/api/channels/setup", {
                  accountId: data.account.id,
                });
                setSetup({ id: data.account.id, ...parameters });
              });
            }}
            className="space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {field(
                "name",
                "渠道名称",
                "方便团队识别，例如：TradePilot 客服服务号。",
                "text",
                true,
              )}
              {draft.channel === "wechat" ? (
                <>
                  {field(
                    "appId",
                    "AppID",
                    "公众号后台「基本配置」中的开发者 ID；保存后不能更换。",
                    "text",
                    true,
                  )}
                  {field(
                    "originalId",
                    "原始 ID（可选）",
                    "公众号基本信息中的 gh_ 开头账号，用于核对消息来源。",
                  )}
                  {field(
                    "appSecret",
                    "AppSecret",
                    draft.id
                      ? "留空保留已保存的密钥；填入新值更新。"
                      : "公众号开发者密码。加密保存，不会回显。",
                    "password",
                    !draft.id,
                  )}
                  {field(
                    "aesKey",
                    "EncodingAESKey",
                    draft.id
                      ? "留空保留原密钥；填入新值后同步更新公众号服务器配置。"
                      : "43 位消息加密密钥；留空自动生成。",
                    "password",
                  )}
                </>
              ) : (
                <>
                  {field(
                    "phoneNumberId",
                    "Phone Number ID",
                    "Meta API Setup 中的号码 ID，不是电话号码本身。",
                    "text",
                    true,
                  )}
                  {field(
                    "wabaId",
                    "WhatsApp Business Account ID（可选）",
                    "Meta API Setup 中的 Business Account ID。",
                  )}
                  {field(
                    "apiVersion",
                    "Graph API 版本",
                    "与 Meta 应用设置使用的版本一致，例如 v24.0。",
                    "text",
                    true,
                  )}
                  {field(
                    "appSecret",
                    "Meta App Secret",
                    draft.id
                      ? "留空保留；更新时填写应用的 App Secret。"
                      : "用于验证来自 Meta 的消息签名，位于应用基本设置。",
                    "password",
                    !draft.id,
                  )}
                  {field(
                    "accessToken",
                    "Access Token",
                    draft.id
                      ? "留空保留；令牌过期或轮换后在这里更新。"
                      : "用于官方 API 收发的访问令牌。加密保存，不会回显。",
                    "password",
                    !draft.id,
                  )}
                </>
              )}
              {field(
                "verifyToken",
                "Token / Verify Token",
                draft.id
                  ? "留空保留；更新后需同步修改平台回调配置。"
                  : "3–32 位字母数字；留空由系统生成。",
                "password",
              )}
            </div>
            <Button type="submit" disabled={!!busy}>
              {busy === "save" && <Loader2 className="size-4 animate-spin" />}
              保存渠道配置
            </Button>
          </form>
        </section>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        配置和消息保存在当前工作区的数据库。AppSecret、Access Token
        和消息加密密钥采用加密存储；只有工作区管理员能查看接入参数。AI
        生成回复草稿后，由你确认并发送。
      </p>
    </div>
  );
}
