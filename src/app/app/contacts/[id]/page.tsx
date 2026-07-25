"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  ClipboardList,
  MapPin,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import type {
  StoredContact,
  StoredInquiry,
  StoredOrder,
  StoredQuotation,
} from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/currency";

interface TimelineItem {
  date: string;
  type: "inquiry" | "quotation" | "order";
  title: string;
  desc: string;
  id: string;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<StoredContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [timelineChecked, setTimelineChecked] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orderableQuotationId, setOrderableQuotationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/contacts/${params.id}`)
        .then(async (response) => {
          const data = (await response.json()) as StoredContact & {
            error?: string;
          };
          if (!response.ok) throw new Error(data.error || "客户加载失败");
          return data;
        })
        .then((data) => {
          setContact(data);
          setLoading(false);
          // Load timeline
          setTlLoading(true);
          setTimelineChecked(false);
          Promise.all([
            fetch("/api/inquiries").then(async (response) => {
              const list = await response.json();
              if (!response.ok || !Array.isArray(list))
                throw new Error("询盘数据加载失败");
              return list as StoredInquiry[];
            }),
            fetch("/api/quotations").then(async (response) => {
              const list = await response.json();
              if (!response.ok || !Array.isArray(list))
                throw new Error("报价数据加载失败");
              return list as StoredQuotation[];
            }),
            fetch("/api/orders").then(async (response) => {
              const list = await response.json();
              if (!response.ok || !Array.isArray(list))
                throw new Error("订单数据加载失败");
              return list as StoredOrder[];
            }),
          ])
            .then(([inquiries, quotations, orders]) => {
              const items: TimelineItem[] = [];
              inquiries
                .filter(
                  (i) => i.contactId === params.id || i.customer === data.name,
                )
                .forEach((i) => {
                  items.push({
                    date: i.createdAt,
                    type: "inquiry",
                    title: i.subject,
                    desc: i.content.slice(0, 80),
                    id: i.id,
                  });
                });
              quotations
                .filter(
                  (q) =>
                    q.contactId === params.id || q.contactName === data.name,
                )
                .forEach((q) => {
                  items.push({
                    date: q.createdAt,
                    type: "quotation",
                    title: q.no,
                    desc: `${formatMoney(q.totalAmount, q.currency)} · ${q.tradeTerm}`,
                    id: q.id,
                  });
                });
              orders
                .filter(
                  (o) =>
                    o.contactId === params.id || o.contactName === data.name,
                )
                .forEach((o) => {
                  items.push({
                    date: o.createdAt,
                    type: "order",
                    title: o.no,
                    desc: `${formatMoney(o.totalAmount, o.currency)} · ${o.status}`,
                    id: o.id,
                  });
                });
              const convertedQuotationIds = new Set(
                orders.map((order) => order.quotationId).filter(Boolean),
              );
              const orderable = quotations.find(
                (quotation) =>
                  quotation.contactId === params.id &&
                  quotation.status === "accepted" &&
                  !convertedQuotationIds.has(quotation.id),
              );
              setOrderableQuotationId(orderable?.id || null);
              items.sort((a, b) => b.date.localeCompare(a.date));
              setTimeline(items);
              setTimelineChecked(true);
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof Error ? error.message : "客户时间线加载失败",
              );
            })
            .finally(() => setTlLoading(false));
        })
        .catch((error: unknown) => {
          toast.error(error instanceof Error ? error.message : "客户加载失败");
        })
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  async function handleGradeChange(grade: string) {
    try {
      const response = await fetch(`/api/contacts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "设置失败");
      setContact(data);
      toast.success(`已设置为 ${grade} 级客户`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "设置失败");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${params.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "删除失败");
      toast.success("客户已删除");
      router.push("/app/contacts");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );
  if (!contact)
    return (
      <div className="p-8 text-center text-muted-foreground">未找到客户</div>
    );
  const primaryPerson =
    contact.persons?.find((person) => person.isPrimary) || contact.persons?.[0];
  const contactEmail = contact.email || primaryPerson?.email;
  const contactPhone = contact.phone || primaryPerson?.phone;
  const deleteBlocked = !timelineChecked || timeline.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <Button
          render={<Link href="/app/contacts" />}
          nativeButton={false}
          variant="ghost"
          size="icon"
          aria-label="返回客户列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {contact.country && (
              <>
                <MapPin className="h-3 w-3" />
                {contact.country} ·{" "}
              </>
            )}
            {contact.source || ""}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Select
            value={contact.grade || ""}
            items={{ A: "A 级客户", B: "B 级客户", C: "C 级客户" }}
            onValueChange={(v) => v && handleGradeChange(v)}
          >
            <SelectTrigger className="w-24 h-8">
              <SelectValue placeholder="客户等级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">
                <span className="text-green-600 font-medium">A 级客户</span>
              </SelectItem>
              <SelectItem value="B">
                <span className="text-blue-600 font-medium">B 级客户</span>
              </SelectItem>
              <SelectItem value="C">
                <span className="text-muted-foreground">C 级客户</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {contact.tags?.map((t: string) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">联系方式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{contactEmail}</span>
              </div>
            )}
            {contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{contactPhone}</span>
              </div>
            )}
            {!contactEmail && !contactPhone && (
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
            <CardTitle className="text-base">客户摘要</CardTitle>
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
        <CardHeader>
          <CardTitle className="text-base">客户时间线</CardTitle>
        </CardHeader>
        <CardContent>
          {tlLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : timeline.length > 0 ? (
            <div className="space-y-0">
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-3 pb-3 relative">
                  {i < timeline.length - 1 && (
                    <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />
                  )}
                  <div
                    className={
                      "mt-1.5 h-3.5 w-3.5 rounded-full shrink-0 " +
                      (item.type === "order"
                        ? "bg-green-500"
                        : item.type === "quotation"
                          ? "bg-blue-500"
                          : "bg-amber-500")
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {item.date}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.desc}
                    </p>
                    <Badge variant="outline" className="h-4 text-[10px] mt-0.5">
                      {item.type === "order"
                        ? "订单"
                        : item.type === "quotation"
                          ? "报价"
                          : "询盘"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              暂无相关活动记录
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          disabled={deleteBlocked}
          title={
            !timelineChecked
              ? "正在检查关联业务记录"
              : timeline.length > 0
                ? "该客户有关联的询盘、报价或订单，不能删除"
                : undefined
          }
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          <span className="text-xs">删除客户</span>
        </Button>
        {contactEmail ? (
          <Button
            render={
              <Link
                href={{ pathname: "/app/email", query: { to: contactEmail } }}
              />
            }
            nativeButton={false}
            variant="outline"
          >
            <Mail className="h-4 w-4 mr-2" /> 准备邮件草稿
          </Button>
        ) : (
          <Button variant="outline" disabled title="该客户没有邮箱">
            <Mail className="h-4 w-4 mr-2" /> 准备邮件草稿
          </Button>
        )}
        <Button
          render={
            <Link
              href={{
                pathname: "/app/quotations/new",
                query: { contactId: contact.id },
              }}
            />
          }
          nativeButton={false}
          variant="outline"
        >
          <FileText className="h-4 w-4 mr-2" /> 新建报价
        </Button>
        {orderableQuotationId ? (
          <Button
            render={
              <Link
                href={{
                  pathname: "/app/orders/new",
                  query: { quotationId: orderableQuotationId },
                }}
              />
            }
            nativeButton={false}
          >
            <ClipboardList className="h-4 w-4 mr-2" /> 新建订单
          </Button>
        ) : (
          <Button disabled title="需要先将该客户的一份报价标记为已接受">
            <ClipboardList className="h-4 w-4 mr-2" /> 新建订单
          </Button>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除客户</DialogTitle>
            <DialogDescription>
              将永久删除客户“{contact.name}”，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
