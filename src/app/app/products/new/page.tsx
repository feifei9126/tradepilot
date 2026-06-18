"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Save, Loader2, ImageIcon, Video, Upload, Info } from "lucide-react";
import Link from "next/link";
import { useAIConfig } from "@/hooks/useAIConfig";

const UNITS = ["件", "个", "套", "箱", "打", "kg", "m", "L"];
const CATEGORIES = ["消费电子", "家居用品", "服装配饰", "工业设备", "汽车配件", "美妆个护", "食品饮料", "办公用品", "运动户外", "其他"];

export default function NewProductPage() {
  const router = useRouter();
  const { getTaskProvider } = useAIConfig();

  const [name, setName] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [category, setCategory] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [unit, setUnit] = useState("件");
  const [moq, setMoq] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [imageFile, setImageFile] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [aiFilling, setAiFilling] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);

  async function handleAIFill() {
    if (!name.trim()) { toast.error("请先输入产品名称"); return; }
    const aiConfig = getTaskProvider("quotation");
    if (!aiConfig) { toast.error("请先在设置中配置 AI 提供商"); return; }

    setAiFilling(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: aiConfig.apiKey, provider: aiConfig.providerId, model: aiConfig.model,
          messages: [{ role: "user", content: `你是一位外贸产品数据录入专家。根据产品名称"${name}"补充以下信息（JSON格式，只返回JSON）：{"modelNo":"型号","hsCode":"HS编码","category":"产品类别","costPrice":成本价数字,"unit":"单位","moq":最小起订量数字,"description":"英文产品描述（50词左右）"}` }],
          maxTokens: 500,
        }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const info = JSON.parse(cleaned);
      if (info.modelNo) setModelNo(info.modelNo);
      if (info.hsCode) setHsCode(info.hsCode);
      if (info.category && CATEGORIES.includes(info.category)) setCategory(info.category);
      if (info.costPrice) setCostPrice(String(info.costPrice));
      if (info.unit) setUnit(info.unit);
      if (info.moq) setMoq(String(info.moq));
      if (info.description) setDescription(info.description);
      toast.success("AI 已补充产品信息");
    } catch { toast.error("AI 填充失败，请手动填写"); }
    finally { setAiFilling(false); }
  }

  function handleImageUpload(file: File) {
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setImageFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleGenerateImage() {
    if (!name.trim()) { toast.error("请先输入产品名称"); return; }
    setImageGenerating(true);
    setTimeout(() => {
      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
      const bg = colors[Math.floor(Math.random() * colors.length)];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <rect width="400" height="400" fill="${bg}15" rx="20"/>
        <rect x="100" y="80" width="200" height="200" rx="16" fill="${bg}" opacity="0.2"/>
        <rect x="140" y="120" width="120" height="120" rx="12" fill="${bg}" opacity="0.4"/>
        <rect x="170" y="150" width="60" height="60" rx="8" fill="${bg}"/>
        <text x="200" y="320" text-anchor="middle" font-size="16" fill="${bg}" font-weight="bold">${name}</text>
        <text x="200" y="345" text-anchor="middle" font-size="12" fill="#999">AI 生成商品预览</text>
      </svg>`;
      setImageFile(`data:image/svg+xml;base64,${btoa(svg)}`);
      setImageGenerating(false);
      toast.success("AI 商品图已生成");
    }, 1200);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写产品名称"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), modelNo: modelNo.trim(), hsCode: hsCode.trim(),
          category, costPrice: parseFloat(costPrice) || 0, unit,
          moq: parseInt(moq) || 0, description, image: imageFile || "",
        }),
      });
      if (res.ok) { toast.success("产品已添加"); router.push("/app/products"); }
      else { toast.error("保存失败"); }
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/app/products"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-semibold">新增产品</h1>
          <p className="text-sm text-muted-foreground">完善产品信息，打造专业外贸产品目录</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Image */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <Label className="mb-2 block">产品图片</Label>
              {imageFile ? (
                <div className="relative">
                  <img src={imageFile} alt="产品图" className="w-full aspect-square object-contain rounded-lg border bg-muted" />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 text-xs bg-background/80"
                    onClick={() => { setImageFile(null); setImageName(""); }}>删除</Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/30 cursor-pointer aspect-square flex flex-col items-center justify-center"
                  onClick={() => document.getElementById("product-img-input")?.click()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
                  onDragOver={(e) => e.preventDefault()}>
                  <Upload className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">拖拽或点击上传图片</p>
                  <p className="text-xs text-muted-foreground mt-1">支持 JPG / PNG / WEBP</p>
                  <input id="product-img-input" type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                </div>
              )}
              {imageName && <p className="text-xs text-muted-foreground mt-1 truncate">{imageName}</p>}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleGenerateImage} disabled={imageGenerating || !name.trim()}>
                {imageGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                AI 生成商品图
              </Button>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-2 text-sm">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-muted-foreground text-xs space-y-1">
                  <p>• 点击「AI 补充」自动填写产品信息</p>
                  <p>• 上传真实产品图片效果更佳</p>
                  <p>• HS 编码可留空，AI 可推测</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns - Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">基本信息</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>产品名称 *</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如: Wireless Bluetooth Earbuds" className="flex-1" />
                    <Button variant="outline" size="sm" onClick={handleAIFill} disabled={aiFilling || !name.trim()} className="shrink-0">
                      {aiFilling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      AI 补充
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>型号 / SKU</Label>
                  <Input value={modelNo} onChange={(e) => setModelNo(e.target.value)} placeholder="BT-E100" className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>产品类别</Label>
                  <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="选择" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>HS 编码</Label>
                  <Input value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="如: 8517.62" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price & Inventory */}
          <Card>
            <CardHeader><CardTitle className="text-base">价格与库存</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>成本价（¥）</Label>
                  <Input type="number" min={0} step={0.01} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" className="mt-1" />
                </div>
                <div>
                  <Label>单位</Label>
                  <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>最小起订量</Label>
                  <Input type="number" min={1} value={moq} onChange={(e) => setMoq(e.target.value)} placeholder="500" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader><CardTitle className="text-base">产品描述</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="产品英文描述，AI 可根据产品名称自动生成。包含产品特点、材质、包装等信息。"
                className="min-h-[120px]" />
              <p className="text-xs text-muted-foreground mt-2">
                提示：点击上方「AI 补充」按钮会自动生成英文描述。好的描述有助于客户理解产品价值。
              </p>
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex gap-3">
            <Link href="/app/products" className="flex-1">
              <Button variant="outline" className="w-full">取消</Button>
            </Link>
            <Button className="flex-1" size="lg" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? "保存中..." : "保存产品"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
