"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MessageSquare, FileText, ClipboardList, MapPin, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tlLoading, setTlLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/contacts/${params.id}`).then(r => r.json()).then(data => {
        setContact(data);
        setLoading(false);
        // Load timeline
        setTlLoading(true);
        Promise.all([
          fetch("/api/inquiries").then(r => r.json()),
          fetch("/api/quotations").then(r => r.json()),
          fetch("/api/orders").then(r => r.json()),
        ]).then(([inquiries, quotations, orders]) => {
          const items: any[] = [];
          inquiries.filter((i: any) => i.contactId === params.id || i.customer === data.name).forEach((i: any) => {
            items.push({ date: i.createdAt, type: "inquiry", title: i.subject, desc: i.content.slice(0, 80), id: i.id });
          });
          quotations.filter((q: any) => q.contactId === params.id || q.contactName === data.name).forEach((q: any) => {
            items.push({ date: q.createdAt, type: "quotation", title: q.no, desc: `$${q.totalAmount?.toLocaleString()} · ${q.tradeTerm}`, id: q.id });
          });
          orders.filter((o: any) => o.contactId === params.id || o.contactName === data.name).forEach((o: any) => {
            items.push({ date: o.createdAt, type: "order", title: o.no, desc: `$${o.totalAmount?.toLocaleString()} · ${o.status}`, id: o.id });
          });
          items.sort((a, b) => b.date.localeCompare(a.date));
          setTimeline(items);
          setTlLoading(false);
        });
      });
    }
  }, [params.id]);

  async function handleGradeChange(grade: string) {
    try {
      await fetch(`/api/contacts/${params.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade }),
      });
      setContact((prev: any) => ({ ...prev, grade }));
      toast.success(`已设置为 ${grade} 级客户`);
    } catch { toast.error("设置失败"); }
  }

  async function handleDelete() {
    if (!confirm("确定要删除此客户吗？此操作不可恢复。")) return;
    try {
      const res = await fetch(`/api/contacts/\${params.id}`, { method: "DELETE" });
      if (res.ok) { toast.success("客户已删除"); router.push("/app/contacts"); }
      else { toast.error("删除失败"); }
    } catch { toast.error("删除失败"); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!contact) return <div className="p-8 text-center text-muted-foreground">未找到客户</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {contact.country && <><MapPin className="h-3 w-3" />{contact.country} · </>}
            {contact.source || ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={contact.grade || ""} onValueChange={(v) => v && handleGradeChange(v)}>
            <SelectTrigger className="w-24 h-8"><SelectValue placeholder="客户等级" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A"><span className="text-green-600 font-medium">A 级客户</span></SelectItem>
              <SelectItem value="B"><span className="text-blue-600 font-medium">B 级客户</span></SelectItem>
              <SelectItem value="C"><span className="text-muted-foreground">C 级客户</span></SelectItem>
            </SelectContent>
          </Select>
          {contact.tags?.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">联系方式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{contact.phone}</span>
              </div>
            )}
            {!contact.email && !contact.phone && (
              <p className="text-sm text-muted-foreground">暂无联系方式</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">备注信息</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {contact.notes || "暂无备注"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI 客户摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {contact.notes
                ? `基于已有信息：${contact.notes}`
                : "暂无客户数据，导入聊天记录后可自动生成分析摘要。"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">客户时间线</CardTitle></CardHeader>
        <CardContent>
          {tlLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />加载中...</div>
          ) : timeline.length > 0 ? (
            <div className="space-y-0">
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-3 pb-3 relative">
                  {i < timeline.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />}
                  <div className={"mt-1.5 h-3.5 w-3.5 rounded-full shrink-0 " + (
                    item.type === "order" ? "bg-green-500" : item.type === "quotation" ? "bg-blue-500" : "bg-amber-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{item.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                    <Badge variant="outline" className="h-4 text-[10px] mt-0.5">{item.type === "order" ? "订单" : item.type === "quotation" ? "报价" : "询盘"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无相关活动记录</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button variant="destructive" size="sm" onClick={handleDelete}><span className="text-xs">删除客户</span></Button>
        <Button variant="outline" disabled><Mail className="h-4 w-4 mr-2" /> 发送邮件</Button>
        <Link href="/app/quotations/new"><Button variant="outline"><FileText className="h-4 w-4 mr-2" /> 新建报价</Button></Link>
        <Link href="/app/quotations"><Button><ClipboardList className="h-4 w-4 mr-2" /> 新建订单</Button></Link>
      </div>
    </div>
  );
}
