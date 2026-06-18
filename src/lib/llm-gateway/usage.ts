// AI用量追踪（MVP：内存存储）
export interface UsageRecord {
  id: string;
  provider: string;
  model: string;
  task: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: string;
}

const records: UsageRecord[] = [];
let idCounter = 0;

export function recordUsage(record: Omit<UsageRecord, "id" | "timestamp">) {
  records.push({
    ...record,
    id: `usage_${++idCounter}`,
    timestamp: new Date().toISOString(),
  });
  // Keep last 1000 records
  if (records.length > 1000) records.splice(0, records.length - 1000);
}

export function getUsageSummary() {
  const total = records.reduce((s, r) => ({ tokens: s.tokens + r.totalTokens, cost: s.cost + r.cost }), { tokens: 0, cost: 0 });
  const byProvider: Record<string, { calls: number; tokens: number; cost: number }> = {};
  const byTask: Record<string, { calls: number; tokens: number }> = {};
  for (const r of records) {
    if (!byProvider[r.provider]) byProvider[r.provider] = { calls: 0, tokens: 0, cost: 0 };
    byProvider[r.provider].calls++;
    byProvider[r.provider].tokens += r.totalTokens;
    byProvider[r.provider].cost += r.cost;
    if (!byTask[r.task]) byTask[r.task] = { calls: 0, tokens: 0 };
    byTask[r.task].calls++;
    byTask[r.task].tokens += r.totalTokens;
  }
  return { total, byProvider, byTask, recent: records.slice(-10).reverse() };
}

// Mock pricing per 1K tokens
const PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-chat": { input: 0.0005, output: 0.002 },
  "deepseek-reasoner": { input: 0.002, output: 0.008 },
  "gpt-4o": { input: 0.01, output: 0.03 },
  "gpt-4o-mini": { input: 0.0015, output: 0.006 },
  "qwen-max": { input: 0.004, output: 0.012 },
  "qwen-plus": { input: 0.0008, output: 0.002 },
};

export function estimateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICING[model] || PRICING["deepseek-chat"] || { input: 0.001, output: 0.003 };
  return (promptTokens * p.input + completionTokens * p.output) / 1000;
}
