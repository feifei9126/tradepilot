"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FieldBuilder } from "@/components/forms/dynamic-form";
import { Input } from "@/components/ui/input";
import {
  Users,
  Package,
  ShoppingCart,
  FileText,
  Ship,
  FileIcon,
  Truck,
  Save,
  Plus,
  X,
  GripVertical,
  RefreshCw,
  ArrowUpDown,
  Eye,
  type LucideIcon,
} from "lucide-react";
import type {
  CustomFieldDef,
  EntityFieldSchema,
  EntityType,
  WorkflowDef,
  WorkflowStage,
} from "@/lib/custom-fields/schema";
import {
  DEFAULT_SECTIONS,
  DEFAULT_ORDER_WORKFLOW,
} from "@/lib/custom-fields/schema";

const ENTITY_CONFIG: { type: EntityType; label: string; icon: LucideIcon }[] = [
  { type: "contact", label: "客户", icon: Users },
  { type: "order", label: "订单", icon: ShoppingCart },
  { type: "product", label: "产品", icon: Package },
  { type: "quotation", label: "报价", icon: FileText },
  { type: "shipment", label: "出货", icon: Ship },
  { type: "invoice", label: "发票", icon: FileIcon },
  { type: "supplier", label: "供应商", icon: Truck },
];

export default function CustomFieldsTab() {
  const [schemas, setSchemas] = useState<Record<string, EntityFieldSchema>>({});
  const [activeEntity, setActiveEntity] = useState<EntityType>("contact");
  const [workflow, setWorkflow] = useState<WorkflowDef>(DEFAULT_ORDER_WORKFLOW);
  const [activeTab, setActiveTab] = useState("fields");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schemasResponse, workflowResponse] = await Promise.all([
        fetch("/api/custom-fields"),
        fetch("/api/custom-fields?entity=workflow"),
      ]);
      if (!schemasResponse.ok || !workflowResponse.ok) {
        throw new Error("Failed to load custom field settings");
      }
      const data = (await schemasResponse.json()) as Record<
        string,
        EntityFieldSchema
      >;
      const w = (await workflowResponse.json()) as WorkflowDef;
      setSchemas(data);
      setWorkflow(w);
    } catch (error) {
      console.warn("Failed to load custom field settings:", error);
      toast.error("自定义字段配置加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function saveSchema(entityType: EntityType) {
    const schema = schemas[entityType];
    if (!schema) return;
    setSaving(true);
    try {
      const r = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, fields: schema.fields }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "保存失败");
      toast.success(
        `${ENTITY_CONFIG.find((e) => e.type === entityType)?.label} 字段已保存`,
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveWorkflow() {
    setSaving(true);
    try {
      const r = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _type: "workflow", data: workflow }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "保存失败");
      toast.success("流程配置已保存");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function updateFields(entityType: EntityType, fields: CustomFieldDef[]) {
    setSchemas((prev) => ({
      ...prev,
      [entityType]: {
        ...(prev[entityType] || {}),
        entityType,
        fields,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function addStage() {
    setWorkflow((w) => ({
      ...w,
      stages: [
        ...w.stages,
        {
          id: `s_${crypto.randomUUID()}`,
          name: "",
          order: w.stages.length,
          color: "#3b82f6",
        },
      ],
    }));
  }

  function updateStage(id: string, upd: Partial<WorkflowStage>) {
    setWorkflow((w) => ({
      ...w,
      stages: w.stages.map((s) => (s.id === id ? { ...s, ...upd } : s)),
    }));
  }

  function removeStage(id: string) {
    setWorkflow((w) => ({
      ...w,
      stages: w.stages.filter((s) => s.id !== id),
    }));
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );

  const activeSchema = schemas[activeEntity];
  const sections = DEFAULT_SECTIONS[activeEntity] || [];
  const sortedStages = [...workflow.stages].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">字段与流程设计草稿</CardTitle>
          <div className="flex gap-2">
            {activeTab === "fields" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => saveSchema(activeEntity)}
                disabled={saving}
              >
                {saving ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                保存字段
              </Button>
            )}
            {activeTab === "workflow" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={saveWorkflow}
                disabled={saving}
              >
                {saving ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                保存流程
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          当前用于设计和保存结构草稿，尚未驱动业务表单或订单状态。
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="fields" className="text-xs">
              <Eye className="h-3.5 w-3.5 mr-1" />
              字段管理
            </TabsTrigger>
            <TabsTrigger value="workflow" className="text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              订单流程
            </TabsTrigger>
          </TabsList>

          {/* Fields Tab */}
          <TabsContent value="fields" className="mt-0 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {ENTITY_CONFIG.map((e) => {
                const Icon = e.icon;
                const fieldCount =
                  activeEntity === e.type
                    ? activeSchema?.fields?.length || 0
                    : schemas[e.type]?.fields?.length || 0;
                return (
                  <Button
                    key={e.type}
                    variant={activeEntity === e.type ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setActiveEntity(e.type)}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1" />
                    {e.label}
                    {fieldCount > 0 && (
                      <span className="ml-1.5 text-xs opacity-70">
                        ({fieldCount})
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              {activeSchema ? (
                <FieldBuilder
                  fields={activeSchema.fields || []}
                  onChange={(f) => updateFields(activeEntity, f)}
                  sections={sections}
                />
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>暂未定义自定义字段</p>
                  <p className="text-xs mt-1">点击下方按钮添加第一个字段</p>
                </div>
              )}
            </div>

            {activeSchema &&
              activeSchema.fields &&
              activeSchema.fields.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  这些字段目前只保存在运行进程中，服务重启后会复位，也不会自动出现在业务页面。
                </div>
              )}
          </TabsContent>

          {/* Workflow Tab */}
          <TabsContent value="workflow" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">订单流程定义</h3>
                <p className="text-xs text-muted-foreground">
                  设计订单阶段草稿；当前订单仍使用内置状态
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={addStage}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                添加阶段
              </Button>
            </div>

            <div className="space-y-2">
              {sortedStages.map((stage, idx) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 border rounded-lg p-3 bg-white"
                >
                  <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                  <div className="flex items-center gap-2 w-8 text-xs text-gray-400 font-mono">
                    #{idx + 1}
                  </div>
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) =>
                      updateStage(stage.id, { color: e.target.value })
                    }
                    className="w-8 h-8 rounded border p-0.5 shrink-0"
                  />
                  <Input
                    value={stage.name}
                    onChange={(e) =>
                      updateStage(stage.id, { name: e.target.value })
                    }
                    placeholder="阶段名称（如：生产完成）"
                    className="h-8 text-sm flex-1"
                  />
                  <Input
                    type="number"
                    value={stage.notifyDays || ""}
                    onChange={(e) =>
                      updateStage(stage.id, {
                        notifyDays: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="提醒(天)"
                    className="h-8 text-xs w-20"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeStage(stage.id)}
                    aria-label={`删除流程阶段 ${stage.name || "未命名"}`}
                    title={`删除流程阶段 ${stage.name || "未命名"}`}
                  >
                    <X className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              ))}
              {workflow.stages.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <ArrowUpDown className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>尚未定义流程阶段</p>
                </div>
              )}
            </div>

            {/* Workflow Preview */}
            {workflow.stages.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">
                  流程预览
                </h4>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {sortedStages.map((stage, idx) => (
                    <div key={stage.id} className="flex items-center shrink-0">
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
                        style={{ backgroundColor: stage.color }}
                      >
                        {idx + 1}. {stage.name || "未命名"}
                      </div>
                      {idx < workflow.stages.length - 1 && (
                        <div className="w-4 h-0.5 bg-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
