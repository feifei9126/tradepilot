import type { BusinessContext } from "@/lib/business/context";
import type {
  ContactCreateInput,
  DashboardBusinessSnapshot,
  InquiryCreateInput,
  OrderFromQuotationInput,
  ProductCreateInput,
  QuotationCreateInput,
  ShipmentCreateInput,
  StoredContact,
  StoredDocument,
  StoredInquiry,
  StoredOrder,
  StoredProduct,
  StoredQuotation,
  StoredShipment,
} from "@/lib/business/types";

export interface ContactRepository {
  list(): Promise<StoredContact[]>;
  get(id: string): Promise<StoredContact | null>;
  create(input: ContactCreateInput): Promise<StoredContact>;
  importBatch(inputs: ContactCreateInput[]): Promise<StoredContact[]>;
  update(id: string, patch: Partial<StoredContact>): Promise<StoredContact | null>;
  removeIfUnreferenced(id: string): Promise<boolean>;
}

export interface ProductRepository {
  list(): Promise<StoredProduct[]>;
  get(id: string): Promise<StoredProduct | null>;
  create(input: ProductCreateInput): Promise<StoredProduct>;
}

export interface InquiryRepository {
  list(): Promise<StoredInquiry[]>;
  get(id: string): Promise<StoredInquiry | null>;
  create(input: InquiryCreateInput): Promise<StoredInquiry>;
  update(
    id: string,
    patch: Partial<Pick<StoredInquiry, "status" | "aiReply">>,
  ): Promise<StoredInquiry | null>;
}

export interface QuotationRepository {
  list(): Promise<StoredQuotation[]>;
  get(id: string): Promise<StoredQuotation | null>;
  create(input: QuotationCreateInput): Promise<StoredQuotation>;
  updateStatus(id: string, status: string): Promise<StoredQuotation>;
}

export interface OrderRepository {
  list(): Promise<StoredOrder[]>;
  get(id: string): Promise<StoredOrder | null>;
  createFromQuotation(input: OrderFromQuotationInput): Promise<StoredOrder>;
  update(id: string, patch: Partial<StoredOrder>): Promise<StoredOrder | null>;
}

export interface ShipmentRepository {
  list(): Promise<StoredShipment[]>;
  get(id: string): Promise<StoredShipment | null>;
  create(input: ShipmentCreateInput): Promise<StoredShipment>;
  advanceStatus(
    id: string,
    status: StoredShipment["status"],
  ): Promise<StoredShipment>;
  remove(id: string): Promise<boolean>;
}

export interface DocumentRepository {
  list(): Promise<StoredDocument[]>;
  get(id: string): Promise<StoredDocument | null>;
  listByOrder(orderId: string): Promise<StoredDocument[]>;
  generateForOrder(orderId: string, types: string[]): Promise<StoredDocument[]>;
  remove(id: string): Promise<boolean>;
}

export interface BusinessRepository {
  contacts: ContactRepository;
  products: ProductRepository;
  inquiries: InquiryRepository;
  quotations: QuotationRepository;
  orders: OrderRepository;
  shipments: ShipmentRepository;
  documents: DocumentRepository;
  dashboard: {
    snapshot(): Promise<DashboardBusinessSnapshot>;
  };
}

export type RepositoryFactory = (
  context: BusinessContext,
) => Promise<BusinessRepository>;
