import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getSchema,
  getAllSchemas,
  updateSchema,
  getWorkflow,
  updateWorkflow,
} from "@/lib/custom-fields/store";
import type { EntityType } from "@/lib/custom-fields/schema";

const ENTITY_TYPES = [
  "contact",
  "order",
  "product",
  "quotation",
  "shipment",
  "invoice",
  "supplier",
] as const;
const FIELD_TYPES = [
  "text",
  "number",
  "select",
  "multiSelect",
  "date",
  "textarea",
  "email",
  "phone",
  "url",
  "boolean",
  "color",
  "currency",
] as const;
const boundedText = (max: number) => z.string().trim().max(max);
const fieldOptionSchema = z
  .object({
    label: boundedText(100).min(1),
    value: boundedText(100).min(1),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
  })
  .strict();
const fieldSchema = z
  .object({
    id: boundedText(100).min(1),
    name: boundedText(100).min(1),
    key: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_]{0,99}$/),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().optional(),
    placeholder: boundedText(300).optional(),
    hint: boundedText(500).optional(),
    options: z.array(fieldOptionSchema).max(100).optional(),
    defaultValue: z
      .union([boundedText(1_000), z.number().finite(), z.boolean(), z.null()])
      .optional(),
    order: z.number().int().min(0).max(999),
    section: boundedText(100).optional(),
    width: z.enum(["full", "half", "third"]).optional(),
  })
  .strict();
const schemaDraft = z
  .object({
    entityType: z.enum(ENTITY_TYPES),
    fields: z.array(fieldSchema).max(100),
  })
  .strict();
const workflowStageSchema = z
  .object({
    id: boundedText(100).min(1),
    name: boundedText(100).min(1),
    order: z.number().int().min(0).max(999),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    description: boundedText(500).optional(),
    assignee: boundedText(100).optional(),
    notifyDays: z.number().int().min(0).max(3_650).optional(),
    requiredDocs: z.array(boundedText(100)).max(100).optional(),
    fields: z.array(boundedText(100)).max(100).optional(),
  })
  .strict();
const workflowDraft = z
  .object({
    _type: z.literal("workflow"),
    data: z
      .object({
        id: boundedText(100).min(1),
        name: boundedText(100).min(1),
        entityType: z.enum(["order", "shipment"]),
        stages: z.array(workflowStageSchema).max(50),
        createdAt: boundedText(50),
      })
      .strict(),
  })
  .strict();

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  if (
    entity &&
    [
      "contact",
      "order",
      "product",
      "quotation",
      "shipment",
      "invoice",
      "supplier",
    ].includes(entity)
  ) {
    return NextResponse.json(getSchema(entity as EntityType));
  }
  if (entity === "workflow") {
    return NextResponse.json(getWorkflow());
  }
  return NextResponse.json(getAllSchemas());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?._type === "workflow") {
      const parsed = workflowDraft.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "流程配置格式无效" },
          { status: 400 },
        );
      }
      const stages = parsed.data.data.stages;
      if (hasDuplicates(stages.map((stage) => stage.id))) {
        return NextResponse.json(
          { error: "流程阶段 ID 不能重复" },
          { status: 400 },
        );
      }
      return NextResponse.json(updateWorkflow(parsed.data.data));
    }
    const parsed = schemaDraft.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "自定义字段配置格式无效" },
        { status: 400 },
      );
    }
    const fields = parsed.data.fields;
    if (
      hasDuplicates(fields.map((field) => field.id)) ||
      hasDuplicates(fields.map((field) => field.key))
    ) {
      return NextResponse.json(
        { error: "字段 ID 和数据 Key 不能重复" },
        { status: 400 },
      );
    }
    return NextResponse.json(updateSchema(parsed.data.entityType, { fields }));
  } catch {
    return NextResponse.json({ error: "请求数据格式无效" }, { status: 400 });
  }
}
