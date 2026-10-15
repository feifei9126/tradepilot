import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { prospecting, ProspectingError, scoreLead } from "../../src/lib/prospecting";

function setup() {
  const scope = randomUUID();
  const persona = prospecting.persona(scope, { name: "出口业务", business: "LED 台灯出口", audience: "采购商", tone: "专业" });
  const task = prospecting.task(scope, { personaId: persona.id, name: "灯具需求", keywords: ["台灯", "采购"], source: "授权公开网页" });
  return { scope, persona, task };
}

test("人设和任务按工作空间隔离，未知人设不可引用", () => {
  const { scope, persona, task } = setup();
  assert.equal(prospecting.list(scope).personas[0].id, persona.id);
  assert.equal(prospecting.list(randomUUID()).tasks.length, 0);
  assert.throws(() => prospecting.task(randomUUID(), { personaId: persona.id, name: task.name, keywords: ["灯"], source: "公开网页" }), /业务人设不存在/);
});

test("线索评分、URL 去重和输入验证", () => {
  const { scope, persona, task } = setup();
  const lead = prospecting.lead(scope, { taskId: task.id, name: "灯具采购商", sourceUrl: "https://example.com/lead?utm_source=ads", excerpt: "正在采购 LED 台灯" });
  assert.equal(lead.score, 85);
  assert.equal(scoreLead(task, persona, "采购商正在采购 LED 台灯").reasons.length, 3);
  assert.throws(() => prospecting.lead(scope, { taskId: task.id, name: "另一客户", sourceUrl: "https://example.com/lead", excerpt: "需要报价" }), (error: unknown) => error instanceof ProspectingError && error.status === 409);
  assert.throws(() => prospecting.lead(scope, { taskId: task.id, name: "非法链接", sourceUrl: "javascript:alert(1)", excerpt: "内容" }));
});

test("人工审阅后才可转入联系人，且不可重复转入", () => {
  const { scope, task } = setup();
  const lead = prospecting.lead(scope, { taskId: task.id, name: "客户", sourceUrl: "https://example.com/p", excerpt: "询价" });
  assert.throws(() => prospecting.promote(scope, lead.id, () => "c1"), /请先审阅/);
  prospecting.patch(scope, { id: lead.id, status: "qualified", draft: "您好", nextFollowUpAt: "2026-10-01" });
  const converted = prospecting.promote(scope, lead.id, () => "c1");
  assert.equal(converted.contactId, "c1");
  assert.equal(converted.status, "converted");
  assert.throws(() => prospecting.promote(scope, lead.id, () => "c2"), /已转入/);
  assert.throws(() => prospecting.patch(scope, { id: lead.id, status: "new" }), /不可修改/);
});
