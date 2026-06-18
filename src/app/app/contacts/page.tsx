"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Search, Users, MapPin, MessageSquare, Download, Upload, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAIConfig } from "@/hooks/useAIConfig";

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [chatSource, setChatSource] = useState("WhatsApp");
  const [chatText, setChatText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [importTab, setImportTab] = useState("paste");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", country: "", source: "手动录入", email: "", phone: "", grade: "" as const, stage: "new" });
  const [stageFilter, setStageFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const { config, loaded } = useAIConfig();

  useEffect(() => {
    fetch("/api/contacts").then(r => r.json()).then(data => { setContacts(data); setLoading(false); });
  }, []);

  async function handleImport() {
    if (!chatText.trim()) { toast.error("请粘贴聊天记录内容"); return; }
    const provider = config.taskMapping?.customer_analysis || "deepseek:deepseek-chat";
    const [pid, m] = provider.split(":");
    const pcfg = config.providers[pid];
    if (!pcfg?.apiKey) { toast.error("请先在设置中配置 AI 提供商"); return; }

    setImporting(true);
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatText,
          source: chatSource,
          apiKey: pcfg.apiKey,
          provider: pid,
          model: m,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data.contacts || []);
        toast.success(`成功导入 ${(data.contacts || []).length} 个客户`);
        // Refresh contacts list
        fetch("/api/contacts").then(r => r.json()).then(setContacts);
      } else {
        toast.error(data.error || "导入失败");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  const filtered = contacts.filter(c => (c.name?.includes(search) || c.country?.includes(search)) && (stageFilter === "all" || c.stage === stageFilter));

  async function handleAdd() {
    if (!addForm.name.trim()) { toast.error("请填写客户名称"); return; }
    try {
      const res = await fetch("/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        toast.success("客户已添加");
        setAddOpen(false);
        setAddForm({ name: "", country: "", source: "手动录入", email: "", phone: "", grade: "" as const, stage: "new" });
        fetch("/api/contacts").then(r => r.json()).then(setContacts);
      } else { toast.error("添加失败"); }
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleExport() {
    setExporting(true);
    const res = await fetch("/api/contacts/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "contacts.csv"; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">客户</h1>
          <p className="text-sm text-muted-foreground mt-1">管理你的客户</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />导入聊天记录
          </Button>
          <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setImportResult([]); setChatText(""); setFileName(""); }}}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>导入聊天记录</DialogTitle>
                <DialogDescription>支持多种方式导入，AI 自动提取客户信息</DialogDescription>
              </DialogHeader>

              {/* Step indicator */}
              <div className="flex items-center gap-2 text-sm mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="rounded-full bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center text-xs font-medium">1</div>
                  <span className={importTab === "paste" || chatText ? "text-foreground font-medium" : "text-muted-foreground"}>选择来源</span>
                </div>
                <div className="h-px flex-1 bg-border mx-2" />
                <div className="flex items-center gap-1.5">
                  <div className={"rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium " + (chatText ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>2</div>
                  <span className={chatText ? "text-foreground font-medium" : "text-muted-foreground"}>导入数据</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>聊天来源</Label>
                    <Select value={chatSource} onValueChange={(v) => v && setChatSource(v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="微信">微信</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tabs: Paste / Upload */}
                <Tabs value={importTab} onValueChange={(v) => v && setImportTab(v)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="paste" className="flex-1">📋 粘贴文本</TabsTrigger>
                    <TabsTrigger value="upload" className="flex-1">📁 上传文件</TabsTrigger>
                  </TabsList>
                  <TabsContent value="paste" className="mt-3">
                    <Label>聊天记录</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      从 <strong>WhatsApp</strong> 导出：打开聊天 → 更多 → 导出聊天 → 选择「不含媒体」→ 复制粘贴下方
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      从 <strong>微信</strong> 导出：打开聊天 → 点击右上角「···」→ 导出聊天记录 → 发送到电脑 → 打开 .txt 文件粘贴
                    </p>
                    <Textarea
                      placeholder={`示例格式:
[2024-01-15 10:30] John: Hi, I\'m interested in your Bluetooth earbuds.
[2024-01-15 10:32] John: Can you send me a quote for 1000pcs to USA?`}
                      className="min-h-[160px] font-mono text-xs"
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="mt-3">
                    <Label>上传文件</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      支持 <strong>.txt</strong> 格式的聊天导出文件。<br/>
                      WhatsApp: 聊天设置 → 导出聊天 → 选择「含媒体」发送到电脑<br/>
                      微信: 聊天详情 → 导出聊天记录 → 选择 .txt 格式
                    </p>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => document.getElementById("chat-file-input")?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) {
                          setFileName(file.name);
                          const reader = new FileReader();
                          reader.onload = (ev) => setChatText(ev.target?.result as string || "");
                          reader.readAsText(file);
                        }
                      }}>
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">拖拽文件到此处，或点击选择</p>
                      <p className="text-xs text-muted-foreground mt-1">支持 .txt 格式</p>
                      {fileName && (
                        <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-1.5 text-sm">
                          <Download className="h-3.5 w-3.5" />
                          {fileName}
                        </div>
                      )}
                    </div>
                    <input id="chat-file-input" type="file" accept=".txt" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFileName(file.name);
                          const reader = new FileReader();
                          reader.onload = (ev) => setChatText(ev.target?.result as string || "");
                          reader.readAsText(file);
                        }
                      }} />
                  </TabsContent>
                </Tabs>

                {/* Chat preview */}
                {chatText && chatText.length > 100 && (
                  <div className="rounded-lg border bg-muted/20 p-3 max-h-24 overflow-y-auto">
                    <p className="text-xs text-muted-foreground mb-1">内容预览（{chatText.length} 字符）</p>
                    <p className="text-xs font-mono text-muted-foreground line-clamp-2">{chatText.slice(0, 200)}...</p>
                  </div>
                )}

                <Button onClick={handleImport} disabled={importing || !chatText.trim()} className="w-full">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  {importing ? "AI 正在解析聊天记录..." : "开始导入"}
                </Button>

                {importResult.length > 0 && (
                  <div className="space-y-3 border rounded-lg p-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className="text-green-600">✅</span> 导入完成 — 发现 {importResult.length} 个客户
                    </p>
                    {importResult.map((c: any) => (
                      <div key={c.id} className="flex items-center gap-3 text-sm bg-muted p-3 rounded-lg">
                        <Users className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.country && `${c.country} · `}
                            {c.tags?.slice(0, 3).join(", ")}
                          </p>
                          {c.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索客户..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Stage Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", "new", "following", "negotiating", "converted", "lost"].map(s => (
          <button key={s} onClick={() => setStageFilter(s)}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (stageFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            {s === "all" ? "全部" : s === "new" ? "新客户" : s === "following" ? "跟进中" : s === "negotiating" ? "洽谈中" : s === "converted" ? "已成交" : "已流失"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((c) => (
          <Link key={c.id} href={`/app/contacts/${c.id}`}>
            <Card className="cursor-pointer hover:bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2"><Users className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.country && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{c.country}</p>}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {c.grade && <Badge variant={c.grade === "A" ? "default" : c.grade === "B" ? "secondary" : "outline"} className={"h-5 text-xs " + (c.grade === "A" ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : c.grade === "B" ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" : "")}>{c.grade}级客户</Badge>}
                      {c.stage && <Badge variant="outline" className={"h-5 text-xs " + (c.stage === "converted" ? "border-green-200 text-green-700" : c.stage === "negotiating" ? "border-blue-200 text-blue-700" : c.stage === "following" ? "border-amber-200 text-amber-700" : c.stage === "lost" ? "border-red-200 text-red-700" : "")}>{c.stage === "new" ? "新客户" : c.stage === "following" ? "跟进中" : c.stage === "negotiating" ? "洽谈中" : c.stage === "converted" ? "已成交" : c.stage === "lost" ? "已流失" : c.stage}</Badge>}
                      {c.tags?.map((t: string) => <Badge key={t} variant="secondary" className="h-5 text-xs">{t}</Badge>)}
                      {c.source && <Badge variant="outline" className="h-5 text-xs">{c.source}</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
