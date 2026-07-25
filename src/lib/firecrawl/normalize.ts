import { randomUUID } from "node:crypto";

import type { StoredProductMedia } from "../store";
import type { FirecrawlProductPreview } from "./types";

type ScrapedData = {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function absoluteUrl(value: unknown, sourceUrl: string) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(decode(value), sourceUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function valuesFromTag(html: string, tag: string, attribute: string, value: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*${attribute}=["']${value}["'][^>]*>`, "ig");
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function metaContent(html: string, key: string) {
  const tags = [
    ...valuesFromTag(html, "meta", "property", key),
    ...valuesFromTag(html, "meta", "name", key),
  ];
  return tags.map((tag) => attribute(tag, "content")).find(Boolean);
}

function jsonLdObjects(html: string) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig)]
    .flatMap((match) => {
      try {
        const value = JSON.parse(match[1]);
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    })
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object");
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function mediaUrls(data: ScrapedData, sourceUrl: string, type: "image" | "video") {
  const html = data.html || "";
  const candidates: unknown[] = [];
  if (type === "image") {
    candidates.push(metaContent(html, "og:image"), metaContent(html, "twitter:image"));
    for (const tag of [...html.matchAll(/<img\b[^>]*>/ig)].map((match) => match[0])) {
      candidates.push(attribute(tag, "src"), attribute(tag, "data-src"), attribute(tag, "data-original"));
    }
    for (const item of jsonLdObjects(html)) {
      if (Array.isArray(item.image)) candidates.push(...item.image);
      else candidates.push(item.image);
    }
    if (data.markdown) {
      candidates.push(...[...data.markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)].map((match) => match[1]));
    }
  } else {
    candidates.push(metaContent(html, "og:video"), metaContent(html, "og:video:url"), metaContent(html, "twitter:player:stream"));
    for (const tag of [...html.matchAll(/<(?:video|source)\b[^>]*>/ig)].map((match) => match[0])) candidates.push(attribute(tag, "src"));
    for (const item of jsonLdObjects(html)) candidates.push(item.contentUrl, item.embedUrl);
    candidates.push(...(data.links || []).filter((link) => /\.(?:mp4|mov|m4v|webm|mkv)(?:$|[?#])/i.test(link)));
    if (data.markdown) candidates.push(...data.markdown.match(/https?:\/\/[^\s)]+\.(?:mp4|mov|m4v|webm|mkv)(?:\?[^\s)]*)?/gi) || []);
  }
  return [...new Set(candidates.map((value) => absoluteUrl(value, sourceUrl)).filter(Boolean))] as string[];
}

function firstProductObject(objects: Record<string, unknown>[]) {
  return objects.find((item) => {
    const type = item["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });
}

export function normalizeFirecrawlProduct(data: ScrapedData, sourceUrl: string): FirecrawlProductPreview {
  const html = data.html || "";
  const metadata = data.metadata || {};
  const product = firstProductObject(jsonLdObjects(html));
  const offer = product?.offers && typeof product.offers === "object" ? product.offers as Record<string, unknown> : undefined;
  const title = firstString(product?.name, metadata.title, metaContent(html, "og:title"), html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], "未识别产品") || "未识别产品";
  const description = firstString(product?.description, metadata.description, metaContent(html, "og:description"));
  const images = mediaUrls(data, sourceUrl, "image");
  const videos = mediaUrls(data, sourceUrl, "video");
  const createdAt = new Date().toISOString();
  const media: StoredProductMedia[] = [
    ...images.slice(0, 12).map((url) => ({ id: randomUUID(), type: "image" as const, url, sourceUrl, mimeType: "image/*", createdAt })),
    ...videos.slice(0, 8).map((url) => ({ id: randomUUID(), type: "video" as const, url, sourceUrl, mimeType: "video/*", createdAt })),
  ];

  return {
    sourceUrl,
    name: decode(title.replace(/<[^>]+>/g, " ")),
    modelNo: firstString(product?.sku, product?.mpn, metadata["product:retailer_item_id"]),
    costPrice: numericPrice(offer?.price || offer?.lowPrice || metadata["og:price:amount"]),
    unit: "件",
    category: firstString(product?.category, metadata["article:section"]),
    description: description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    media,
    note: media.length > 0
      ? `已提取 ${images.length} 张图片和 ${videos.length} 个视频链接，确认后可用于产品视频重制。`
      : "页面未发现可直接使用的图片或视频链接，请确认后手动补充素材。",
  };
}
