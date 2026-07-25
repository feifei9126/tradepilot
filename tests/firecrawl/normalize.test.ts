import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFirecrawlProduct } from "../../src/lib/firecrawl/normalize";

test("normalizes product data and discovers image and video media", () => {
  const preview = normalizeFirecrawlProduct({
    html: `
      <html><head>
        <title>Portable Charger</title>
        <meta property="og:description" content="65W fast charging">
        <meta property="og:image" content="/hero.png">
        <meta property="og:video" content="https://cdn.example.com/demo.mp4">
        <script type="application/ld+json">
          {"@type":"Product","name":"Portable Charger 20000mAh","sku":"PB-200","offers":{"price":"65.00"},"image":["/product.jpg"]}
        </script>
      </head><body>
        <video><source src="/demo-2.mp4" type="video/mp4"></video>
        <img src="/detail.jpg">
      </body></html>`,
    links: ["https://cdn.example.com/from-link.webm"],
  }, "https://shop.example.com/products/pb-200");

  assert.equal(preview.name, "Portable Charger 20000mAh");
  assert.equal(preview.modelNo, "PB-200");
  assert.equal(preview.costPrice, 65);
  assert.equal(preview.media.filter((item) => item.type === "image").length, 3);
  assert.equal(preview.media.filter((item) => item.type === "video").length, 3);
  assert.ok(preview.media.some((item) => item.url === "https://shop.example.com/demo-2.mp4"));
});

test("ignores unsafe and non-http media URLs", () => {
  const preview = normalizeFirecrawlProduct({
    html: '<img src="javascript:alert(1)"><video src="file:///tmp/demo.mp4"></video>',
    markdown: "![x](data:image/png;base64,abc)",
  }, "https://shop.example.com/products/pb-200");
  assert.equal(preview.media.length, 0);
});
