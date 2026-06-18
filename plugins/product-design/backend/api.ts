// 产品设计插件 — 后端 API
// 提供 AI 商品图生成、规格书导出、目录生成等功能

import { store } from "@/lib/store";
import { llmGateway } from "@/lib/llm-gateway";

export interface ProductImageRequest {
  productId: string;
  style: "professional" | "lifestyle" | "minimal";
  count?: number;
}

export interface ProductCatalogRequest {
  productIds: string[];
  language: string;
  format: "pdf" | "excel";
}

export const productDesignAPI = {
  // AI 生成产品描述
  async generateDescription(productId: string, language: string = "zh") {
    const product = store.products.get(productId);
    if (!product) throw new Error("产品不存在");

    const prompt = `请为以下外贸产品生成专业的${language === "en" ? "英文" : "中文"}产品描述。
产品名称: ${product.name}
型号: ${product.modelNo || "-"}
HS编码: ${product.hsCode || "-"}
规格: ${product.description || "无"}

要求：突出卖点、规格参数、应用场景、包装信息。语言专业、简洁、有说服力。`;

    const result = await llmGateway.chat("email_compose", [
      { role: "system", content: "你是专业的外贸产品文案撰写专家。" },
      { role: "user", content: prompt },
    ]);

    return result.content;
  },

  // 生成多语言描述
  async generateMultiLangDescription(productId: string) {
    const languages = ["zh", "en", "es", "ar", "fr", "de"];
    const descriptions: Record<string, string> = {};
    for (const lang of languages) {
      descriptions[lang] = await this.generateDescription(productId, lang);
    }
    return descriptions;
  },

  // 生成产品规格书
  async generateSpecSheet(productId: string) {
    const product = store.products.get(productId);
    if (!product) throw new Error("产品不存在");

    return {
      productName: product.name,
      modelNo: product.modelNo,
      hsCode: product.hsCode,
      unit: product.unit,
      moq: product.moq,
      costPrice: product.costPrice,
      description: product.description,
      features: [
        "高品质材料制造",
        "通过 ISO9001 认证",
        "可按客户要求定制",
        "提供 OEM/ODM 服务",
      ],
      packageInfo: {
        type: "出口标准包装",
        cartonSize: "根据实际产品",
        quantityPerCarton: 0,
      },
    };
  },

  // 模拟 AI 商品图生成
  async generateProductImage(productId: string, style: string = "professional") {
    const product = store.products.get(productId);
    if (!product) throw new Error("产品不存在");

    // 返回模拟的图片 URL（实际可对接 DALL-E / Stable Diffusion）
    return {
      productId,
      productName: product.name,
      images: [
        { url: `/api/placeholder/product-${productId}-1.jpg`, style, caption: `${product.name} - 主图` },
        { url: `/api/placeholder/product-${productId}-2.jpg`, style, caption: `${product.name} - 细节图` },
      ],
    };
  },

  // 生成产品目录
  async generateCatalog(options: ProductCatalogRequest) {
    const products = options.productIds
      .map(id => store.products.get(id))
      .filter(Boolean);

    return {
      title: "产品目录",
      language: options.language,
      format: options.format,
      generatedAt: new Date().toISOString(),
      productCount: products.length,
      products: products.map(p => ({
        name: p?.name,
        modelNo: p?.modelNo,
        description: p?.description,
        unit: p?.unit,
      })),
    };
  },

  // 获取产品设计模板列表
  getDesignTemplates() {
    return [
      { id: "catalog-modern", name: "现代简约目录", preview: "/templates/catalog-modern.png" },
      { id: "catalog-classic", name: "经典商务目录", preview: "/templates/catalog-classic.png" },
      { id: "spec-basic", name: "基础规格书", preview: "/templates/spec-basic.png" },
      { id: "spec-detailed", name: "详细规格书", preview: "/templates/spec-detailed.png" },
    ];
  },
};
