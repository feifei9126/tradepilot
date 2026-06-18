import { PluginInstance, PluginManifest, registerHook, triggerHook } from "../../src/plugins";
import manifest from "./plugin.json";
import { productDesignAPI } from "./backend/api";

const plugin: PluginInstance = {
  manifest: manifest as unknown as PluginManifest,
  isActive: true,
  settings: {
    imageStyle: "professional",
    autoGenerateImages: false,
    defaultCatalogLang: "zh",
  },

  async onLoad() {
    console.log("[Plugin] 产品设计插件已加载");

    // 注册钩子：产品创建后自动生成描述
    registerHook("product.afterCreate", async (ctx) => {
      const product = ctx.data;
      console.log("[ProductDesign] 新产品创建:", product.name);
      if (this.settings.autoGenerateImages) {
        const images = await productDesignAPI.generateProductImage(product.id, this.settings.imageStyle);
        console.log(`  → 已生成 ${images.images.length} 张商品图`);
      }
      return { generated: true };
    });

    // 注册钩子：客户创建后，如果关联产品则生成多语言描述
    registerHook("contact.afterCreate", async (ctx) => {
      console.log("[ProductDesign] 新客户创建:", ctx.data.name);
      return { tracked: true };
    });
  },

  async onUnload() {
    console.log("[Plugin] 产品设计插件已卸载");
  },

  async onHook(context) {
    return null;
  },
};

export default plugin;
