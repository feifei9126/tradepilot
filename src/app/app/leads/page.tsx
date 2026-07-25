"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  MessageSquare,
  Globe,
  Mail,
  CheckCircle2,
  Image,
  Video,
  Package,
  X,
  Plus,
  Trash2,
} from "lucide-react";

const CHANNELS = [
  { id: "email", name: "邮件文案", icon: Mail, color: "bg-blue-500" },
  {
    id: "whatsapp",
    name: "WhatsApp 文案",
    icon: MessageSquare,
    color: "bg-green-500",
  },
  { id: "social", name: "社媒广告方案", icon: Globe, color: "bg-purple-500" },
];

interface Product {
  id: string;
  name: string;
}

interface CampaignDraft {
  campaignName: string;
  enabledChannels: string[];
  targetIndustry: string;
  targetCountry: string;
  selectedProducts: Product[];
  mediaUrls: { type: "image" | "video"; url: string; name: string }[];
  scheduleDate: string;
  socialPlatform: string;
  socialBudget: string;
  generated: string;
  savedAt: string;
}

function savedText(value: unknown, fallback = "", maxLength = 2_000) {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function savedProducts(value: unknown): Product[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is Product =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as Product).id === "string" &&
            typeof (item as Product).name === "string",
        )
        .slice(0, 100)
        .map((item) => ({
          id: item.id.slice(0, 200),
          name: item.name.slice(0, 200),
        }))
    : [];
}

function savedMedia(value: unknown): CampaignDraft["mediaUrls"] {
  if (!Array.isArray(value)) return [];
  const media: CampaignDraft["mediaUrls"] = [];
  for (const rawItem of value.slice(0, 100)) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Record<string, unknown>;
    const type = item.type;
    if (type !== "image" && type !== "video") continue;
    if (typeof item.url !== "string") continue;
    try {
      const url = new URL(item.url);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      media.push({
        type,
        url: url.toString().slice(0, 2_048),
        name: savedText(item.name, "media", 200),
      });
    } catch {
      continue;
    }
  }
  return media;
}

export default function LeadsPage() {
  const [step, setStep] = useState(1);

  // Campaign state
  const [campaignName, setCampaignName] = useState("");
  const [enabledChannels, setEnabledChannels] = useState<string[]>(["email"]);
  const [targetIndustry, setTargetIndustry] = useState("");
  const [targetCountry, setTargetCountry] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [mediaUrls, setMediaUrls] = useState<
    { type: "image" | "video"; url: string; name: string }[]
  >([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [generated, setGenerated] = useState("");
  const [saved, setSaved] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState("linkedin");
  const [socialBudget, setSocialBudget] = useState("50");
  // Load state
  const [products, setProducts] = useState<Product[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");

  useEffect(() => {
    fetch("/api/products")
      .then(async (productResponse) => {
        if (!productResponse.ok) throw new Error("产品数据加载失败");
        setProducts((await productResponse.json()) as Product[]);
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "产品数据加载失败",
        );
      });

    const draftTimer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("tradepilot_campaign_draft");
        if (!stored) return;
        const draft = JSON.parse(stored) as Partial<CampaignDraft>;
        setCampaignName(savedText(draft.campaignName, "", 200));
        setEnabledChannels(
          Array.isArray(draft.enabledChannels)
            ? draft.enabledChannels.filter(
                (channel): channel is string =>
                  typeof channel === "string" &&
                  CHANNELS.some((item) => item.id === channel),
              )
            : ["email"],
        );
        setTargetIndustry(savedText(draft.targetIndustry, "", 200));
        setTargetCountry(savedText(draft.targetCountry, "", 200));
        setSelectedProducts(savedProducts(draft.selectedProducts));
        setMediaUrls(savedMedia(draft.mediaUrls));
        setScheduleDate(savedText(draft.scheduleDate, "", 10));
        setSocialPlatform(savedText(draft.socialPlatform, "linkedin", 50));
        setSocialBudget(savedText(draft.socialBudget, "50", 30));
        const restoredDraft = savedText(draft.generated, "", 100_000);
        setGenerated(restoredDraft);
        setSaved(Boolean(restoredDraft));
        if (restoredDraft) setStep(3);
      } catch {
        localStorage.removeItem("tradepilot_campaign_draft");
        toast.error("本地营销草稿已损坏，已清除");
      }
    }, 0);

    return () => window.clearTimeout(draftTimer);
  }, []);

  function toggleChannel(id: string) {
    setEnabledChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function addProduct(p: Product) {
    if (!selectedProducts.find((sp) => sp.id === p.id)) {
      setSelectedProducts([...selectedProducts, p]);
    }
  }

  function removeProduct(id: string) {
    setSelectedProducts(selectedProducts.filter((sp) => sp.id !== id));
  }

  function addMedia() {
    if (!newMediaUrl.trim()) return;
    let parsed: URL;
    try {
      parsed = new URL(newMediaUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      toast.error("请输入有效的 HTTP(S) 素材地址");
      return;
    }
    setMediaUrls([
      ...mediaUrls,
      {
        type: newMediaType,
        url: parsed.toString(),
        name: parsed.pathname.split("/").pop() || "media",
      },
    ]);
    setNewMediaUrl("");
  }

  function removeMedia(index: number) {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  }

  function handleGenerateDraft() {
    if (!campaignName.trim()) {
      toast.error("请填写活动名称");
      return;
    }
    if (enabledChannels.length === 0) {
      toast.error("请至少选择一个渠道");
      return;
    }
    setGenerating(true);
    const channels = enabledChannels
      .map((id) => CHANNELS.find((c) => c.id === id)?.name)
      .join("、");
    const products = selectedProducts.map((p) => p.name).join(", ");
    const mediaList = mediaUrls
      .map((m) => `[${m.type === "image" ? "图片" : "视频"}]: ${m.url}`)
      .join("\n");
    setGenerated(`Campaign: ${campaignName}
────────────────────────
Channels: ${channels}
Target: ${targetIndustry || "General"} / ${targetCountry || "Global"}
Products: ${products || "Not specified"}
Planned date: ${scheduleDate || "Not scheduled"}
Social draft: ${enabledChannels.includes("social") ? `${socialPlatform} / proposed USD ${socialBudget || "0"} daily budget` : "Not selected"}
Media Assets:
${mediaList || "  (none)"}

─── EMAIL COPY ────────────────────────────
From: [Verified sender name and email]
To: [Selected customer]
Subject: ${campaignName}${products ? ` - ${products}` : ""}

Dear Partner,

We would like to introduce our ${targetIndustry || "product"} offering for your review.

${products ? "Our products: " + products : ""}

Before sending, replace this section with verified facts:
• Product specifications and available variants
• Actual certifications and test reports
• Confirmed MOQ, pricing and payment terms
• Confirmed production lead time and delivery terms

Catalog & samples available upon request.

Best regards,
[Your name and company]
[Media attachments: ${mediaUrls.length > 0 ? mediaUrls.length + " file(s)" : "none"}]

─── FOLLOW-UP PLAN (NOT SCHEDULED) ─────────
Day 1: Review and send through the selected channel (${channels})
Day 3: Check delivery/open status before deciding whether to follow up
Day 7: Prepare a relevant product update if the customer has not replied
Day 14: Decide whether to close or continue the outreach`);
    setGenerating(false);
    setStep(3);
    toast.success("营销策略草稿已生成");
  }

  function handleSaveDraft() {
    if (!generated) return;
    setSavingDraft(true);
    try {
      const draft: CampaignDraft = {
        campaignName,
        enabledChannels,
        targetIndustry,
        targetCountry,
        selectedProducts,
        mediaUrls,
        scheduleDate,
        socialPlatform,
        socialBudget,
        generated,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem("tradepilot_campaign_draft", JSON.stringify(draft));
      setSaved(true);
      toast.success("营销策略草稿已保存到本机");
    } catch {
      toast.error("草稿保存失败");
    } finally {
      setSavingDraft(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">营销策略</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            整理产品推广文案与跟进计划，保存为本地草稿
          </p>
        </div>
        {saved && (
          <Badge variant="default" className="bg-green-600">
            草稿已保存
          </Badge>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, label: "配置活动" },
          { n: 2, label: "素材与内容" },
          { n: 3, label: "预览与保存" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {s.n}
            </div>
            <span
              className={step >= s.n ? "font-medium" : "text-muted-foreground"}
            >
              {s.label}
            </span>
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
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  1
                </div>
                <h3 className="text-sm font-medium">活动配置</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">活动名称</Label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="如: 2026夏季新品推广"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">计划覆盖渠道</Label>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {CHANNELS.map((ch) => {
                      const Icon = ch.icon;
                      const on = enabledChannels.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => toggleChannel(ch.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${on ? `${ch.color} text-white border-transparent` : "bg-background text-muted-foreground hover:bg-muted"}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {ch.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">目标行业</Label>
                    <Input
                      value={targetIndustry}
                      onChange={(e) => setTargetIndustry(e.target.value)}
                      placeholder="消费电子"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">目标国家</Label>
                    <Input
                      value={targetCountry}
                      onChange={(e) => setTargetCountry(e.target.value)}
                      placeholder="美国、德国"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">计划投放时间</Label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Products & Media */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  2
                </div>
                <h3 className="text-sm font-medium">产品与素材</h3>
              </div>

              {/* Product Selection */}
              <div className="mb-3">
                <Label className="text-xs">选择推广产品</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {products
                    .filter(
                      (p) => !selectedProducts.find((sp) => sp.id === p.id),
                    )
                    .slice(0, 6)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="px-2.5 py-1 rounded-md text-xs border bg-muted/30 hover:bg-muted text-muted-foreground flex items-center gap-1"
                      >
                        <Package className="h-3 w-3" />
                        {p.name}
                      </button>
                    ))}
                </div>
              </div>
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedProducts.map((p) => (
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="h-6 text-xs gap-1"
                    >
                      <Package className="h-3 w-3" />
                      {p.name}
                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        aria-label={`移除 ${p.name}`}
                      >
                        <X className="h-3 w-3 ml-0.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Media Upload */}
              <div>
                <Label className="text-xs">产品图片/视频素材</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setNewMediaType("image")}
                      className={`px-2 py-1 rounded text-xs border ${newMediaType === "image" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                    >
                      <Image className="h-3 w-3 inline mr-0.5" />
                      图片
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMediaType("video")}
                      className={`px-2 py-1 rounded text-xs border ${newMediaType === "video" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                    >
                      <Video className="h-3 w-3 inline mr-0.5" />
                      视频
                    </button>
                  </div>
                  <Input
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    placeholder="输入图片/视频 URL..."
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={addMedia}
                    disabled={!newMediaUrl.trim()}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    添加
                  </Button>
                </div>
                {mediaUrls.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {mediaUrls.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                      >
                        {m.type === "image" ? (
                          <Image className="h-3 w-3 text-blue-500" />
                        ) : (
                          <Video className="h-3 w-3 text-purple-500" />
                        )}
                        <span className="flex-1 truncate">{m.url}</span>
                        <button
                          type="button"
                          onClick={() => removeMedia(i)}
                          aria-label={`移除素材 ${m.name}`}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          {/* Sender Config */}
          {/* Social ad planning */}
          {enabledChannels.includes("social") && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Globe className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-medium">
                    社媒广告方案（仅草稿）
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    {["linkedin", "facebook", "google"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSocialPlatform(p)}
                        className={
                          "flex-1 px-2 py-1.5 rounded text-xs font-medium border " +
                          (socialPlatform === p
                            ? "bg-purple-50 border-purple-300 text-purple-700"
                            : "bg-background text-muted-foreground")
                        }
                      >
                        {p === "linkedin"
                          ? "LinkedIn"
                          : p === "facebook"
                            ? "Facebook"
                            : "Google Ads"}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div>
                      <Label className="text-[10px]">计划日预算 ($)</Label>
                      <input
                        className="w-full mt-0.5 border rounded px-2 py-1.5 text-xs"
                        placeholder="50"
                        value={socialBudget}
                        onChange={(e) => setSocialBudget(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded p-2 text-[10px] text-purple-700">
                    <p>
                      草稿目标: {targetIndustry || "通用行业"} ·{" "}
                      {targetCountry || "全球市场"}
                    </p>
                    <p>
                      计划素材:{" "}
                      {mediaUrls.length > 0
                        ? mediaUrls.length + " 个素材"
                        : "未添加素材"}
                      。保存不会向广告平台提交。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerateDraft}
            disabled={generating || !campaignName.trim()}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? "正在整理草稿..." : "整理文案与跟进计划草稿"}
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
                  营销方案预览
                </h3>
                {generated && (
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(generated)
                          .then(() => toast.success("已复制"))
                          .catch(() =>
                            toast.error("复制失败，请检查浏览器权限"),
                          );
                      }}
                    >
                      复制
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setGenerated("");
                        setStep(1);
                        setSaved(false);
                      }}
                    >
                      重置
                    </Button>
                  </div>
                )}
              </div>
              {generated ? (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-2.5 border-b flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground">
                      {campaignName}
                    </span>
                    <span>|</span>
                    <span>
                      📨{" "}
                      {enabledChannels
                        .map((id) => CHANNELS.find((c) => c.id === id)?.name)
                        .join(", ")}
                    </span>
                    <span>|</span>
                    <span>🎯 {targetCountry || "Global"}</span>
                    {selectedProducts.length > 0 && (
                      <>
                        <span>|</span>
                        <span>📦 {selectedProducts.length} 产品</span>
                      </>
                    )}
                    {mediaUrls.length > 0 && (
                      <>
                        <span>|</span>
                        <span>🖼️ {mediaUrls.length} 素材</span>
                      </>
                    )}
                  </div>
                  <div className="p-4 text-sm whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-700 max-h-[350px] overflow-y-auto">
                    {generated}
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    配置活动后生成营销策略草稿
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    系统会按当前字段整理待审核文案、跟进计划和素材清单，不会自动发送或投放
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Panel */}
          {generated && !saved && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-100 p-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        准备保存
                      </p>
                      <p className="text-xs text-green-600">
                        {enabledChannels.length} 个渠道方案 ·{" "}
                        {selectedProducts.length} 个产品 · {mediaUrls.length}{" "}
                        个素材
                        {scheduleDate
                          ? ` · 计划日期: ${scheduleDate}`
                          : " · 未设置日期"}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                    onClick={handleSaveDraft}
                    disabled={savingDraft}
                  >
                    {savingDraft ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    {savingDraft ? "保存中..." : "保存草稿"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deployed Status */}
          {saved && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    营销策略草稿已保存
                  </p>
                  <p className="text-xs text-green-600">
                    已保存到当前浏览器，可在本页继续编辑或复制到实际发送平台
                    {scheduleDate ? ` · 计划日期: ${scheduleDate}` : ""}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="ml-auto h-6 text-xs border-green-300 text-green-700 bg-green-100"
                >
                  本地草稿
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
