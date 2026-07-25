import type { StoredProductMedia } from "../store";

export type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    links?: string[];
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: string;
  message?: string;
};

export type FirecrawlProductPreview = {
  sourceUrl: string;
  name: string;
  modelNo?: string;
  costPrice?: number;
  unit: string;
  category?: string;
  description?: string;
  media: StoredProductMedia[];
  note?: string;
};
