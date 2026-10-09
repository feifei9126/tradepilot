"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, RefreshCw, Server, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatabaseStatus } from "@/lib/database-status";

const storageRows = [
  { name: "账号、工作区、团队成员、个人设置", location: "PostgreSQL：companies / users", persistence: "数据库；按工作区授权" },
  { name: "客户、产品、询盘、报价、订单、出货、消息、单证等", location: "PostgreSQL：crm_records / crm_record_links", persistence: "数据库；租户复合主键和关联键" },
  { name: "AI 获客人设、任务、线索、去重与运行时间", location: "PostgreSQL：crm_records", persistence: "数据库；不再使用生产 JSON 文件" },
  { name: "视频任务元数据、自定义字段、邮箱参数草稿", location: "PostgreSQL：crm_records", persistence: "数据库；邮箱参数不等于实际收发服务" },
  { name: "操作审计、业务编号计数器", location: "PostgreSQL：audit_events / crm_counters", persistence: "数据库；随事务写入" },
  { name: "视频成品和素材", location: "视频 Worker 数据卷 / 配置的对象存储", persistence: "不在数据库备份中；需单独备份" },
  { name: "实例 API 密钥配置、部署账号资料覆盖", location: "TRADEPILOT_DATA_DIR 持久卷文件", persistence: "需单独备份数据卷和加密主密钥" },
  { name: "部分 AI 营销草稿、界面偏好", location: "当前浏览器 localStorage", persistence: "仅本浏览器；不在数据库备份中" },
];
const migrationLabels = { applied: "已应用 · 校验通过", pending: "待执行", mismatch: "校验不一致 · 禁止发布" };
const kindLabels: Record<string, string> = { contacts: "客户", products: "产品", inquiries: "询盘", quotations: "报价", orders: "订单", shipments: "出货", documents: "单证", messages: "消息", suppliers: "供应商", tasks: "任务", bindings: "绑定", emails: "邮件记录", email_accounts: "邮箱参数草稿", custom_fields: "字段 / 流程设置", prospect_personas: "获客人设", prospect_tasks: "获客任务", prospect_leads: "获客线索", product_video_jobs: "视频元数据" };

export function DatabaseAdminPanel() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback((signal?: AbortSignal) => {
    return fetch("/api/admin/database", { cache: "no-store", signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "数据库状态读取失败");
        return data;
      })
      .then(data => {
        if (signal?.aborted) return;
        setStatus(data);
      })
      .catch(cause => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "数据库状态读取失败");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  const healthy = status?.state === "ready";

  return <div className="page-stack mx-auto max-w-6xl">
    <div className="page-heading flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="page-kicker">PLATFORM / DATABASE & BACKUP</p><h1>数据库管理</h1><p className="page-description">平台管理员只读控制台：连接状态、结构迁移、数据计数及配置 / 备份指南。不会在浏览器显示连接密码，也不提供任意 SQL 或删库操作。</p></div>
      <Button variant="outline" onClick={() => { setLoading(true); setError(""); void refresh(); }} disabled={loading}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />{loading ? "检查中…" : "刷新状态"}</Button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader className="pb-2"><CardDescription>数据库连接</CardDescription><CardTitle className="flex items-center gap-2 text-lg">{status?.connected ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-amber-600" />}{loading ? "检查中" : status?.connected ? "PostgreSQL 已连接" : "未连接"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">配置来源：{status?.configSource || "未配置"}<br />{status?.sslMode || "连接参数仅在服务器保存"}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardDescription>结构 / 迁移</CardDescription><CardTitle className="text-lg">{loading ? "检查中" : status?.schemaReady ? "本版本结构就绪" : "待初始化 / 修复"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{status?.tableCount ?? 0} 张 public 表 · {status?.migrations.filter(m => m.state === "applied").length ?? 0}/{status?.migrations.length ?? 0} 个迁移校验通过<br />库大小：{status?.databaseSizeBytes == null ? "—" : `${(status.databaseSizeBytes / 1024 / 1024).toFixed(1)} MiB`}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardDescription>SaaS 上线门禁</CardDescription><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="size-5 text-amber-600" />注册仍关闭</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">已接入租户数据库不等于可以公网运营。计费、租户 AI 预算、真实邮件发送、外部服务和运维仍需独立验收。</CardContent></Card>
    </div>
    {status && <p role="status" className={healthy ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-amber-700 dark:text-amber-300"}>{status.message}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>迁移版本与校验</CardTitle><CardDescription>最后执行：{status?.lastMigrationAt ? new Date(status.lastMigrationAt).toLocaleString("zh-CN") : "尚无记录"}。已执行 SQL 不能改写，只能追加迁移。</CardDescription></CardHeader><CardContent className="space-y-3 text-sm">{status?.migrations.map(m => <div key={m.version} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><code className="text-xs">{m.version}</code><span className={m.state === "applied" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{migrationLabels[m.state]}</span></div>)}{!!status?.missingSchema.length && <p role="alert" className="break-all text-xs text-destructive">缺失结构：{status.missingSchema.join("、")}</p>}{!!status?.unexpectedMigrations.length && <p role="alert" className="text-xs text-destructive">数据库版本超出当前发布：{status.unexpectedMigrations.join("、")}。请使用匹配版本，不要回退或改写历史。</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>业务存储统计</CardTitle><CardDescription>只返回聚合数量，不展示客户内容、账号密码或完整连接串。</CardDescription></CardHeader><CardContent className="text-sm">{status?.totals ? <><div className="mb-4 grid grid-cols-2 gap-3 text-xs"><span>工作区：{status.totals.workspaces}</span><span>用户：{status.totals.users}</span><span>业务记录：{status.totals.records}</span><span>审计事件：{status.totals.auditEvents}</span></div><div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">{status.recordCounts.map(r => <div key={r.kind} className="flex justify-between gap-2 rounded-md bg-muted/40 p-2"><span>{kindLabels[r.kind] || r.kind}</span><strong>{r.count}</strong></div>)}</div>{!status.recordCounts.length && <p className="text-muted-foreground">数据库为空是正常的。新工作区不加载其他客户或共享示例数据。</p>}</> : <p className="text-muted-foreground">数据库结构校验通过后显示统计。</p>}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="size-4" />所有数据都在数据库里吗？</CardTitle><CardDescription>不是。核心业务、获客和账号已入库，媒体、部署配置和浏览器草稿需分别备份。旧演示文件不会自动分配给新客户。</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="px-3 py-3">数据类别</th><th className="px-3 py-3">存储位置</th><th className="px-3 py-3">注意事项</th></tr></thead><tbody>{storageRows.map(row => <tr key={row.name} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{row.name}</td><td className="px-3 py-3 text-muted-foreground">{row.location}</td><td className="px-3 py-3">{row.persistence}</td></tr>)}</tbody></table></CardContent></Card>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Server className="size-4" />初学者：怎么配置数据库？</CardTitle><CardDescription>推荐先用 Compose 内置 PostgreSQL，数据库不暴露到公网。</CardDescription></CardHeader><CardContent className="space-y-4 text-sm">
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground"><li>复制 <code>.env.example</code> 为 <code>.env</code>，设置随机的 <code>POSTGRES_PASSWORD</code>、<code>AUTH_SECRET</code>、部署管理员邮箱和强密码。已有环境文件不要覆盖。</li><li>执行 <code>docker compose up -d --build</code>。数据库就绪后，<code>db-init</code> 自动执行迁移和首次管理员初始化；重复启动不会自动改密。</li><li>登录后刷新此页，检查“本版本结构就绪”；再在“SaaS 工作区”创建客户，在“团队管理”添加同事。</li></ol>
        <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs leading-6"># 使用外部数据库 / 本机 Node 时<br />PGHOST=你的数据库主机<br />PGPORT=5432<br />PGDATABASE=tradepilot<br />PGUSER=tradepilot<br />PGPASSWORD=只保存在服务器的强密码<br />PGSSLMODE=verify-full<br />PGSSLROOTCERT=/run/secrets/postgres-ca.pem<br />npm run db:init</div>
        <p className="text-xs text-muted-foreground">也支持 DATABASE_URL（优先于 PG*）。推荐外部数据库校验 CA 和主机名；require 只加密，不验证服务器身份；disable 仅限本地受信网络。默认 Compose 固定使用内部 postgres，外部库需要按部署文档调整应用和 db-init 两处环境 / 依赖。</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />备份与安全恢复</CardTitle><CardDescription>恢复只能使用独立的空目标库；没有浏览器端“覆盖数据库”按钮。</CardDescription></CardHeader><CardContent className="space-y-4 text-sm">
        <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs leading-6">npm run db:backup<br /># Docker：docker compose exec tradepilot npm run db:backup<br /># 默认 backups/tradepilot-时间.dump；请及时拷出容器保管</div>
        <p className="text-muted-foreground">备份包含客户和账号敏感数据：文件仅所有者可读，须加密异地保存。数据库备份不包括媒体卷、部署配置、加密主密钥和 localStorage；这些必须单独保护。</p>
        <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs leading-6">RESTORE_DATABASE_URL=独立的新空库连接串<br />CONFIRM_RESTORE=I_HAVE_VERIFIED_THE_EMPTY_TARGET<br />npm run db:restore -- backups/文件.dump</div>
        <p className="text-xs text-muted-foreground">脚本自动拒绝非空目标，不继承生产库地址，不清理已有表。先隔离目标库的并发写入，恢复后核验记录、账号和租户隔离，再切流量。CLI 需要匹配版本的 pg_dump / psql / pg_restore（Docker 镜像已包含 PostgreSQL 16 客户端）。</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Download className="size-4 shrink-0" />完整操作、外部库配置和灾备核验见 docs/database-management.md。</p>
      </CardContent></Card>
    </div>
  </div>;
}
