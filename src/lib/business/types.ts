export interface StoredContact {
  id: string;
  name: string;
  country?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  email?: string;
  phone?: string;
  grade?: "A" | "B" | "C";
  stage?: string;
  persons?: {
    name: string;
    position?: string;
    phone?: string;
    email?: string;
    isPrimary?: boolean;
  }[];
  activities?: { date: string; type: string; note: string }[];
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  createdAt: string;
}

export interface StoredProductMedia {
  id: string;
  type: "image" | "video";
  url: string;
  sourceUrl?: string;
  title?: string;
  mimeType?: string;
  createdAt: string;
}

export interface StoredProduct {
  stockQuantity?: number;
  lowStockThreshold?: number;
  warehouse?: string;
  id: string;
  name: string;
  modelNo?: string;
  hsCode?: string;
  costPrice?: number;
  unit: string;
  moq?: number;
  category?: string;
  description?: string;
  source?: string;
  media?: StoredProductMedia[];
}

export interface StoredInquiry {
  id: string;
  customer: string;
  contactId?: string;
  subject: string;
  content: string;
  source: string;
  status: "pending" | "quoted" | "converted" | "lost";
  aiReply?: string;
  createdAt: string;
}

export interface StoredLineItem {
  productId?: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
}

export interface StoredQuotation {
  id: string;
  no: string;
  contactId: string;
  contactName: string;
  items: StoredLineItem[];
  totalAmount: number;
  currency: string;
  tradeTerm: string;
  status: string;
  aiGenerated: boolean;
  createdAt: string;
  orderId?: string | null;
}

export interface StoredOrder {
  id: string;
  no: string;
  contactId: string;
  contactName: string;
  quotationId?: string;
  items: StoredLineItem[];
  totalAmount: number;
  currency?: string;
  status: string;
  deliveryDate?: string;
  progressPercent: number;
  tradeTerm?: string;
  comms?: { from: string; date: string; channel: string; text: string }[];
  createdAt: string;
}

export interface StoredShipment {
  id: string;
  orderId: string;
  orderNo: string;
  customer: string;
  method: "sea" | "air" | "express";
  carrier: string;
  referenceNo: string;
  etd?: string;
  eta?: string;
  status: "booked" | "departed" | "in_transit" | "delivered";
  createdAt: string;
}

export interface StoredDocument {
  id: string;
  orderId: string;
  orderNo: string;
  type: string;
  status: "draft" | "generated";
  createdAt: string;
  content?: string;
}

export type ContactCreateInput = Omit<StoredContact, "id" | "createdAt"> & {
  createdAt?: string;
};
export type ProductCreateInput = Omit<StoredProduct, "id">;
export type InquiryCreateInput = Omit<
  StoredInquiry,
  "id" | "status" | "aiReply" | "createdAt"
>;
export type QuotationCreateInput = Pick<
  StoredQuotation,
  "contactId" | "items" | "currency" | "tradeTerm" | "aiGenerated"
>;
export interface OrderFromQuotationInput {
  quotationId: string;
  deliveryDate: string;
}
export type ShipmentCreateInput = Pick<
  StoredShipment,
  "orderId" | "method" | "carrier" | "referenceNo" | "etd" | "eta"
>;

export interface DashboardBusinessSnapshot {
  contacts: StoredContact[];
  products: StoredProduct[];
  inquiries: StoredInquiry[];
  quotations: StoredQuotation[];
  orders: StoredOrder[];
}

export interface DemoBusinessData extends DashboardBusinessSnapshot {
  shipments: StoredShipment[];
  documents: StoredDocument[];
}
