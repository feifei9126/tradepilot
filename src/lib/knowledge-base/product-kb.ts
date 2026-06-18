import { store, StoredProduct } from "../store";

// 产品关键词提取（中英文）
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[.,!?;:()'"\-\[\]{}]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1);
  return [...new Set(words)];
}

// 模糊匹配评分
function matchScore(product: StoredProduct, keywords: string[]): number {
  let score = 0;
  const searchFields = [
    product.name.toLowerCase(),
    (product.modelNo || "").toLowerCase(),
    (product.hsCode || "").toLowerCase(),
    (product.description || "").toLowerCase(),
    (product.category || "").toLowerCase(),
  ];

  for (const kw of keywords) {
    for (const field of searchFields) {
      if (field.includes(kw)) {
        // 精确匹配产品名加分更高
        if (field === product.name.toLowerCase() && field.includes(kw)) score += 3;
        else score += 1;
      }
    }
    // 型号匹配加分 (exact model match)
    if (product.modelNo?.toLowerCase() === kw) score += 5;
    if (product.hsCode?.toLowerCase() === kw) score += 2;
  }
  return score;
}

export interface ProductMatch {
  product: StoredProduct;
  score: number;
  matchedField?: string;
}

/**
 * 从客户消息中检索关联产品
 * 返回匹配度排序的产品列表
 */
export function searchProducts(message: string, limit = 3): ProductMatch[] {
  const keywords = extractKeywords(message);
  if (keywords.length === 0) return [];

  const products = store.products.list();
  const scored = products
    .map(p => ({ product: p, score: matchScore(p, keywords) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/**
 * 构建产品上下文，用于注入 AI 提示词
 */
export function buildProductContext(matches: ProductMatch[]): string {
  if (matches.length === 0) return "";

  const lines = matches.map((m, i) => {
    const p = m.product;
    const price = p.costPrice ? `$ ${p.costPrice}/pc` : "请联系询价";
    return `[产品${i + 1}]
名称: ${p.name}
型号: ${p.modelNo || "-"}
HS编码: ${p.hsCode || "-"}
参考成本价: ${price}
起订量(MOQ): ${p.moq || "联系确认"} ${p.unit}
描述: ${p.description || "请联系我们获取详细产品资料"}
`;
  });

  return `\n【匹配的产品资料】\n${lines.join("\n")}\n【使用说明】在回复客户时，可以引用以上产品信息。如果有匹配产品，请结合产品信息回答客户问题。\n`;
}

/**
 * 判断消息是否需要产品检索
 * 包含价格/报价/产品/型号/规格等关键词时触发
 */
export function shouldSearchProducts(message: string): boolean {
  const triggers = [
    "price", "quote", "cost", "product", "model", "moq",
    "sample", "order", "buy", "purchase", "interested in",
    "price list", "catalog",
    // 中文
    "价格", "报价", "产品", "型号", "样品", "订购",
    "多少钱", "采购", "询价",
  ];
  const msg = message.toLowerCase();
  return triggers.some(t => msg.includes(t));
}
