"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CustomFieldDef, FieldSection, EntityFieldSchema, EntityType,
} from "@/lib/custom-fields/schema";

export function DynamicForm({
  schema, data, onChange, errors = {}, disabled,
}: {
  schema: EntityFieldSchema;
  data: Record<string, any>;
  onChange: (key: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const renderField = (field: CustomFieldDef) => {
    const value = data[field.key] ?? field.defaultValue ?? "";
    const error = errors[field.key];
    const w = field.width === "half" ? "col-span-1" : "col-span-full";
    return (
      <div key={field.id} className={cn(w, "space-y-1.5")}>
        <Label className="text-xs font-medium text-gray-700">
          {field.name}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {field.type === "textarea" ? (
          <Textarea value={value} onChange={e => onChange(field.key, e.target.value)}
            placeholder={field.placeholder} disabled={disabled} rows={3}
            className={cn("h-9 text-sm", error && "border-red-400")} />
        ) : field.type === "select" ? (
          <Select value={value} onValueChange={v => onChange(field.key, v)} disabled={disabled}>
            <SelectTrigger className={cn("h-9 text-sm", error && "border-red-400")}>
              <SelectValue placeholder={field.placeholder || "\u8bf7\u9009\u62e9..."} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "multiSelect" ? (
          <MultiSelect field={field} value={value} onChange={v => onChange(field.key, v)} disabled={disabled} />
        ) : field.type === "boolean" ? (
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input type="checkbox" checked={!!value}
              onChange={e => onChange(field.key, e.target.checked)}
              disabled={disabled} className="rounded" />
            <span className="text-sm text-gray-600">{field.placeholder || field.name}</span>
          </label>
        ) : field.type === "color" ? (
          <div className="flex items-center gap-2">
            <input type="color" value={value || "#3b82f6"}
              onChange={e => onChange(field.key, e.target.value)}
              className="w-10 h-9 p-0.5 border rounded" disabled={disabled} />
            <Input value={value || ""} onChange={e => onChange(field.key, e.target.value)}
              placeholder="#3b82f6" className="h-9 text-sm flex-1" disabled={disabled} />
          </div>
        ) : (
          <Input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={value} onChange={e => onChange(field.key, e.target.value)}
            placeholder={field.placeholder} disabled={disabled}
            className={cn("h-9 text-sm", error && "border-red-400")} />
        )}
        {field.hint && !error && <p className="text-xs text-gray-400">{field.hint}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  };

  const sections = schema.sections || [];
  const map = new Map<string, CustomFieldDef[]>();
  const unassigned: CustomFieldDef[] = [];
  for (const f of schema.fields) {
    if (f.section) {
      const arr = map.get(f.section) || [];
      arr.push(f);
      map.set(f.section, arr);
    } else unassigned.push(f);
  }

  return (
    <div className="space-y-5">
      {unassigned.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          {unassigned.sort((a, b) => a.order - b.order).map(renderField)}
        </div>
      )}
      {sections.sort((a, b) => a.order - b.order).map(section => {
        const fields = map.get(section.id);
        if (!fields?.length) return null;
        return (
          <div key={section.id}>
            <div className="flex items-center gap-2 mb-3">
              {section.icon && <span>{section.icon}</span>}
              <h3 className="text-sm font-semibold text-gray-700">{section.label}</h3>
              <div className="flex-1 border-t border-gray-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              {fields.sort((a, b) => a.order - b.order).map(renderField)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MultiSelect({ field, value, onChange, disabled }: any) {
  const selected = Array.isArray(value) ? value : [];
  const unselected = (field.options || []).filter((o: any) => !selected.includes(o.value));
  const add = (v: string) => onChange([...selected, v]);
  const remove = (v: string) => onChange(selected.filter((s: string) => s !== v));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((v: string) => {
          const opt = (field.options || []).find((o: any) => o.value === v);
          return (
            <Badge key={v} variant="secondary" className="text-xs gap-1 pl-2">
              {opt?.label || v}
              {!disabled && <X className="h-3 w-3 cursor-pointer" onClick={() => remove(v)} />}
            </Badge>
          );
        })}
      </div>
      {!disabled && unselected.length > 0 && (
        <Select value="" onValueChange={add}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="+ \u6dfb\u52a0..." />
          </SelectTrigger>
          <SelectContent>
            {unselected.map((o: any) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// Field Builder UI for Settings page
export function FieldBuilder({
  fields, onChange, sections = [],
}: {
  fields: CustomFieldDef[];
  onChange: (f: CustomFieldDef[]) => void;
  sections?: FieldSection[];
}) {
  const add = () => onChange([...fields, {
    id: "f_" + Date.now(), name: "", key: "", type: "text" as const, order: fields.length,
  }]);
  const upd = (id: string, u: Partial<CustomFieldDef>) => onChange(fields.map(f => f.id === id ? { ...f, ...u } : f));
  const del = (id: string) => onChange(fields.filter(f => f.id !== id));

  return (
    <div className="space-y-3">
      {fields.sort((a, b) => a.order - b.order).map((f, i) => (
        <div key={f.id} className="border rounded-lg p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-300" />
              <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
              <Badge variant="outline" className="text-xs">{f.type}</Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => del(f.id)}>
              <X className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">\u5b57\u6bb5\u540d\u79f0</Label>
              <Input value={f.name} onChange={e => upd(f.id, { name: e.target.value })} placeholder="\u5982\uff1a\u5ba2\u6237\u7b49\u7ea7" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">\u6570\u636e Key</Label>
              <Input value={f.key} onChange={e => upd(f.id, { key: e.target.value })} placeholder="customerGrade" className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">\u5b57\u6bb5\u7c7b\u578b</Label>
              <Select value={f.type} onValueChange={(v: any) => upd(f.id, { type: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["text","number","select","multiSelect","date","textarea","email","phone","url","boolean","color","currency"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">\u5360\u4f4d\u63d0\u793a</Label>
              <Input value={f.placeholder || ""} onChange={e => upd(f.id, { placeholder: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">\u9ed8\u8ba4\u503c</Label>
              <Input value={f.defaultValue || ""} onChange={e => upd(f.id, { defaultValue: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">\u6240\u5c5e\u5206\u533a</Label>
              <Select value={f.section || ""} onValueChange={v => upd(f.id, { section: v || undefined })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="\u9ed8\u8ba4" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">\uff08\u9ed8\u8ba4\uff09</SelectItem>
                  {sections.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!f.required} onChange={e => upd(f.id, { required: e.target.checked })} />
              \u5fc5\u586b
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={f.width === "half"} onChange={e => upd(f.id, { width: e.target.checked ? "half" : undefined })} />
              \u534a\u5bbd\u5e03\u5c40
            </label>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="w-full h-9 text-sm">
        <Plus className="h-4 w-4 mr-1" /> \u6dfb\u52a0\u81ea\u5b9a\u4e49\u5b57\u6bb5
      </Button>
    </div>
  );
}
