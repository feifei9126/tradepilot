"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAIConfig } from "@/hooks/useAIConfig";
import {
  Target, Send, Bot, Loader2, Sparkles, MessageSquare, Globe, Mail,
  BarChart3, CheckCircle2, Image, Video, Upload, Clock, Play, Pause,
  Package, X, Plus, Trash2, Calendar
} from "lucide-react";

const CHANNELS = [
  { id: "email", name: "邮件营销", icon: Mail, color: "bg-blue-500" },
  { id: "whatsapp", name: "WhatsApp", icon: MessageSquare, color: "bg-green-500" },
  { id: "social", name: "社媒投放", icon: Globe, color: "bg-purple-500" },
];

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState("campaign");
  const [step, setStep] = useState(1);

  // Campaign state
  const [campaignName, setCampaignName] = useState("");
  const [enabledChannels, setEnabledChannels] = useState<string[]>(["email"]);
  const [targetIndustry, setTargetIndustry] = useState("");
  const [targetCountry, setTargetCountry] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [mediaUrls, setMediaUrls] = useState<{ type: "image" | "video"; url: string; name: string }[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [generated, setGenerated] = useState("");
  const [deployed, setDeployed] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchPreview, setBatchPreview] = useState<any[]>([]);
  const [socialPlatform, setSocialPlatform] = useState("linkedin");
  const [socialAdAccount, setSocialAdAccount] = useState("");
  const [socialBudget, setSocialBudget] = useState("50");
  const [senderConfig, setSenderConfig] = useState<any>({ email: "", smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", whatsappPhone: "" });
  const { config: aiConfig } = useAIConfig();


  // Load state
  const [products, setProducts] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(data => {
      setProducts(data);
      setAvailableProducts(data.filter((p: any) => !selectedProducts.find(sp => sp.id === p.id)));
    });
    fetch("/api/contacts").then(r => r.json()).then(data => setContacts(data));
    try { const saved = localStorage.getItem("tradepilot_sender_config"); if (saved) setSenderConfig(JSON.parse(saved)); } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(data => {
      setProducts(data);
      setAvailableProducts(data.filter((p: any) => !selectedProducts.find(sp => sp.id === p.id)));
    });
  }, []);

  function toggleChannel(id: string) {
    setEnabledChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  function addProduct(p: any) {
    if (!selectedProducts.find(sp => sp.id === p.id)) {
      setSelectedProducts([...selectedProducts, p]);
      setAvailableProducts(availableProducts.filter(ap => ap.id !== p.id));
    }
  }

  function removeProduct(id: string) {
    const p = selectedProducts.find(sp => sp.id === id);
    setSelectedProducts(selectedProducts.filter(sp => sp.id !== id));
    if (p) setAvailableProducts([...availableProducts, p]);
  }

  function addMedia() {
    if (!newMediaUrl.trim()) return;
    setMediaUrls([...mediaUrls, { type: newMediaType, url: newMediaUrl, name: newMediaUrl.split("/").pop() || "media" }]);
    setNewMediaUrl("");
  }

  function removeMedia(index: number) {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  }

  const filteredRecipients = contacts.filter(c =>
    (c.email || c.phone) && (!recipientFilter || c.name?.includes(recipientFilter) || c.country?.includes(recipientFilter))
  );

  function parseBatchImport(text: string) {
    const lines = text.split("\n").filter(l => l.trim());
    const parsed = lines.map(l => {
      const trimmed = l.trim();
      if (trimmed.includes("@")) return { name: trimmed.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()), email: trimmed };
      if (trimmed.startsWith("+") || /^\d{7,15}$/.test(trimmed.replace(/[\s-]/g, ""))) return { name: "Lead " + trimmed.slice(-4), phone: trimmed };
      return { name: trimmed, email: "" };
    });
    setBatchPreview(parsed);
  }

  function confirmBatchImport() {
    const newNames = batchPreview.map(p => p.name).filter(n => !selectedRecipients.includes(n));
    setSelectedRecipients(prev => [...prev, ...newNames]);
    setBatchImportOpen(false);
    setBatchText("");
    setBatchPreview([]);
    toast.success("已导入 " + newNames.length + " 个收件人");
  }

  function toggleRecipient(name: string) {
    setSelectedRecipients(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  function saveSenderConfig() {
    try { localStorage.setItem("tradepilot_sender_config", JSON.stringify(senderConfig)); toast.success("发件配置已保存"); } catch { toast.error("保存失败"); }
  }

  async function handleAIGenerate() {
    if (!campaignName.trim()) { toast.error("请填写活动名称"); return; }
    if (enabledChannels.length === 0) { toast.error("请至少选择一个渠道"); return; }
    setGenerating(true);
    setTimeout(() => {
      const channels = enabledChannels.map(id => CHANNELS.find(c => c.id === id)?.name).join("、");
      const products = selectedProducts.map(p => p.name).join(", ");
      const mediaList = mediaUrls.map(m => `[${m.type === "image" ? "图片" : "视频"}]: ${m.url}`).join("\n");
      const date = new Date().toLocaleDateString();
      setGenerated(`Campaign: ${campaignName}
────────────────────────
Channels: ${channels}
Target: ${targetIndustry || "General"} / ${targetCountry || "Global"}
Products: ${products || "Not specified"}
Schedule: ${scheduleDate || "Immediate"}
Media Assets:
${mediaList || "  (none)"}

─── EMAIL COPY ────────────────────────────
From: TradePilot <marketing@tradepilot.dev>
To: {target}@{target}.com
Subject: Partnership - Premium Products

Dear Partner,

We manufacture high-quality ${targetIndustry || "industry"} products for the ${targetCountry || "global"} market.

${products ? "Our products: " + products : ""}

Advantages:
• Factory-direct pricing
• ISO quality certified
• Flexible MOQ & OEM
• 25-30 day delivery

Catalog & samples available upon request.

Best regards,
TradePilot Export Team
[Media attachments: ${mediaUrls.length > 0 ? mediaUrls.length + " file(s)" : "none"}]

─── FOLLOW-UP SCHEDULE ────────────────────
Day 1: Initial outreach (${channels})
Day 3: Re-send to unopened
Day 7: Follow-up with product update
Day 14: Final check-in`);
      setGenerating(false);
      setStep(3);
      toast.success("营销策略已生成");
    }, 2000);
  }

  async function handleDeploy() {
    setDeploying(true);
    setTimeout(() => {
      setDeployed(true);
      setDeploying(false);
      toast.success(`活动「${campaignName}」已自动部署到 ${enabledChannels.length} 个渠道`);
    }, 2000);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI 获客</h1>
          <p className="text-sm text-muted-foreground mt-0.5">创建营销活动，AI 自动生成策略并多渠道投放</p>
        </div>
        {deployed && <Badge variant="default" className="bg-green-600">活动进行中</Badge>}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[{ n: 1, label: "配置活动" }, { n: 2, label: "素材与内容" }, { n: 3, label: "预览与投放" }].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.n}</div>
            <span className={step >= s.n ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < 2 && <div className="h-px w-8 bg-border mx-1" />}
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: 3-column setup */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1: Campaign Config */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">1</div>
                <h3 className="text-sm font-medium">活动配置</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">活动名称</Label>
                  <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="如: 2026夏季新品推广" className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">投放渠道</Label>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {CHANNELS.map(ch => {
                      const Icon = ch.icon;
                      const on = enabledChannels.includes(ch.id);
                      return (
                        <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${on ? `${ch.color} text-white border-transparent` : "bg-background text-muted-foreground hover:bg-muted"}`}>
                          <Icon className="h-3.5 w-3.5" />{ch.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">目标行业</Label>
                    <Input value={targetIndustry} onChange={e => setTargetIndustry(e.target.value)} placeholder="消费电子" className="mt-1 h-9 text-sm" /></div>
                  <div><Label className="text-xs">目标国家</Label>
                    <Input value={targetCountry} onChange={e => setTargetCountry(e.target.value)} placeholder="美国、德国" className="mt-1 h-9 text-sm" /></div>
                </div>
                <div>
                  <Label className="text-xs">计划投放时间</Label>
                  <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="mt-1 h-9 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Products & Media */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">2</div>
                <h3 className="text-sm font-medium">产品与素材</h3>
              </div>

              {/* Product Selection */}
              <div className="mb-3">
                <Label className="text-xs">选择推广产品</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {products.filter(p => !selectedProducts.find(sp => sp.id === p.id)).slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="px-2.5 py-1 rounded-md text-xs border bg-muted/30 hover:bg-muted text-muted-foreground flex items-center gap-1">
                      <Package className="h-3 w-3" />{p.name}
                    </button>
                  ))}
                </div>
              </div>
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedProducts.map(p => (
                    <Badge key={p.id} variant="secondary" className="h-6 text-xs gap-1">
                      <Package className="h-3 w-3" />{p.name}
                      <button onClick={() => removeProduct(p.id)}><X className="h-3 w-3 ml-0.5" /></button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Media Upload */}
              <div>
                <Label className="text-xs">产品图片/视频素材</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex gap-1">
                    <button onClick={() => setNewMediaType("image")}
                      className={`px-2 py-1 rounded text-xs border ${newMediaType === "image" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                      <Image className="h-3 w-3 inline mr-0.5" />图片
                    </button>
                    <button onClick={() => setNewMediaType("video")}
                      className={`px-2 py-1 rounded text-xs border ${newMediaType === "video" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                      <Video className="h-3 w-3 inline mr-0.5" />视频
                    </button>
                  </div>
                  <Input value={newMediaUrl} onChange={e => setNewMediaUrl(e.target.value)}
                    placeholder="输入图片/视频 URL..." className="flex-1 h-8 text-xs" />
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addMedia} disabled={!newMediaUrl.trim()}>
                    <Plus className="h-3 w-3 mr-1" />添加
                  </Button>
                </div>
                {mediaUrls.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {mediaUrls.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                        {m.type === "image" ? <Image className="h-3 w-3 text-blue-500" /> : <Video className="h-3 w-3 text-purple-500" />}
                        <span className="flex-1 truncate">{m.url}</span>
                        <button onClick={() => removeMedia(i)}><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          {/* Sender Config */}
          {/* Social Media投放口 */}
          {enabledChannels.includes("social") && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Globe className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-medium">社媒投放配置</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    {["linkedin", "facebook", "google"].map(p => (
                      <button key={p} onClick={() => setSocialPlatform(p)}
                        className={"flex-1 px-2 py-1.5 rounded text-xs font-medium border " + (socialPlatform === p ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-background text-muted-foreground")}>
                        {p === "linkedin" ? "LinkedIn" : p === "facebook" ? "Facebook" : "Google Ads"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px]">广告账户 ID</Label>
                      <input className="w-full mt-0.5 border rounded px-2 py-1.5 text-xs" placeholder={socialPlatform === "linkedin" ? "LinkedIn Page ID" : socialPlatform === "facebook" ? "FB Ad Account ID" : "Google Ads CID"}
                        value={socialAdAccount} onChange={e => setSocialAdAccount(e.target.value)} /></div>
                    <div><Label className="text-[10px]">日预算 ($)</Label>
                      <input className="w-full mt-0.5 border rounded px-2 py-1.5 text-xs" placeholder="50" value={socialBudget} onChange={e => setSocialBudget(e.target.value)} /></div>
                  </div>
                  <div className="bg-purple-50 rounded p-2 text-[10px] text-purple-700">
                    <p>💡 投放将定向到: {targetIndustry || "通用行业"} · {targetCountry || "全球市场"}</p>
                    <p>广告素材: {mediaUrls.length > 0 ? mediaUrls.length + " 个素材" : "未添加素材"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">发件配置</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <Label className="text-[10px]">发件邮箱 (SMTP)</Label>
                  <input className="w-full mt-0.5 border rounded px-2 py-1.5 text-xs" placeholder="smtp.gmail.com" value={senderConfig.smtpHost}
                    onChange={e => setSenderConfig({...senderConfig, smtpHost: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="border rounded px-2 py-1.5 text-xs" placeholder="发件人邮箱" value={senderConfig.email}
                    onChange={e => setSenderConfig({...senderConfig, email: e.target.value})} />
                  <input className="border rounded px-2 py-1.5 text-xs" placeholder="SMTP 密码" type="password" value={senderConfig.smtpPass}
                    onChange={e => setSenderConfig({...senderConfig, smtpPass: e.target.value})} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3 text-green-500" />
                    <span>WhatsApp: </span>
                    <input className="border rounded px-2 py-1 text-xs w-36" placeholder="+86 手机号" value={senderConfig.whatsappPhone}
                      onChange={e => setSenderConfig({...senderConfig, whatsappPhone: e.target.value})} />
                  </div>
                  <button onClick={saveSenderConfig} className="text-[10px] text-primary hover:underline">保存配置</button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleAIGenerate} disabled={generating || !campaignName.trim()}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {generating ? "AI 正在生成营销策略..." : "AI 生成完整营销策略"}
          </Button>
        </div>

        {/* Right: Preview & Deploy */}
        <div className="lg:col-span-3 space-y-4">
          {/* Generated Content */}
          <Card className={generated ? "border-primary/20" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" />
                  营销内容预览
                </h3>
                {generated && (
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(generated); toast.success("已复制"); }}>复制</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setGenerated(""); setStep(1); setDeployed(false); }}>重置</Button>
                  </div>
                )}
              </div>
              {generated ? (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-2.5 border-b flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground">{campaignName}</span>
                    <span>|</span>
                    <span>📨 {enabledChannels.map(id => CHANNELS.find(c => c.id === id)?.name).join(", ")}</span>
                    <span>|</span>
                    <span>🎯 {targetCountry || "Global"}</span>
                    {selectedProducts.length > 0 && <><span>|</span><span>📦 {selectedProducts.length} 产品</span></>}
                    {mediaUrls.length > 0 && <><span>|</span><span>🖼️ {mediaUrls.length} 素材</span></>}
                  </div>
                  <div className="p-4 text-sm whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-700 max-h-[350px] overflow-y-auto">
                    {generated}
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">配置活动后点击「AI 生成完整营销策略」</p>
                  <p className="text-xs text-muted-foreground mt-1">AI 将自动生成邮件文案、跟进计划和素材配置</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deploy Panel */}
          {generated && !deployed && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-100 p-2"><Play className="h-4 w-4 text-green-600" /></div>
                    <div>
                      <p className="text-sm font-medium text-green-800">准备投放</p>
                      <p className="text-xs text-green-600">
                        {enabledChannels.length} 个渠道 · {selectedRecipients.length || contacts.length} 个收件人 · {selectedProducts.length} 个产品 · {mediaUrls.length} 个素材
                        {scheduleDate ? ` · 定时: ${scheduleDate}` : " · 立即发送"}
                      </p>
                    </div>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-700" size="sm" onClick={handleDeploy} disabled={deploying}>
                    {deploying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    {deploying ? "自动投放中..." : "一键自动投放"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deployed Status */}
          {deployed && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-800">活动已自动投放</p>
                  <p className="text-xs text-green-600">
                    已通过 {enabledChannels.map(id => CHANNELS.find(c => c.id === id)?.name).join("、")} 触达 {targetCountry || "目标"} 市场
                    {scheduleDate ? ` · 定时: ${scheduleDate}` : " · 立即执行"}
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto h-6 text-xs border-green-300 text-green-700 bg-green-100">进行中</Badge>
              </CardContent>
            </Card>
          )}

          {/* Analytics */}
          <div className="grid grid-cols-4 gap-3">
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">0</p><p className="text-xs text-muted-foreground">触达</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">0</p><p className="text-xs text-muted-foreground">回复</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">0%</p><p className="text-xs text-muted-foreground">转化</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-blue-600">{mediaUrls.length}</p><p className="text-xs text-muted-foreground">素材</p></CardContent></Card>
          </div>
        </div>
      </div>
    </div>
  );
}
