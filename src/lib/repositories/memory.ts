import { randomUUID } from "node:crypto";

import type { BusinessContext } from "@/lib/business/context";
import { BusinessError } from "@/lib/business/errors";
import { DEMO_COMPANY_ID } from "@/lib/business/runtime";
import type {
  ContactCreateInput,
  DemoBusinessData,
  StoredContact,
  StoredDocument,
  StoredInquiry,
  StoredOrder,
  StoredProduct,
  StoredQuotation,
  StoredShipment,
} from "@/lib/business/types";
import { snapshotDemoBusinessData } from "@/lib/store";

import type { BusinessRepository } from "./contracts";

interface MemoryRepositoryOptions {
  seedDemo?: boolean;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyState(): DemoBusinessData {
  return {
    contacts: [],
    products: [],
    inquiries: [],
    quotations: [],
    orders: [],
    shipments: [],
    documents: [],
  };
}

function findIndex<T extends { id: string }>(records: T[], id: string) {
  return records.findIndex((record) => record.id === id);
}

function nextSequence(records: { no: string }[]) {
  return (
    Math.max(
      0,
      ...records.map((record) => Number(record.no.match(/-(\d+)$/)?.[1] || 0)),
    ) + 1
  );
}

function sequenceNo(prefix: "QTN" | "ORD", records: { no: string }[]) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(nextSequence(records)).padStart(3, "0")}`;
}

function createTenantRepository(state: DemoBusinessData): BusinessRepository {
  const contactById = (id: string) =>
    state.contacts.find((contact) => contact.id === id);
  const quotationById = (id: string) =>
    state.quotations.find((quotation) => quotation.id === id);
  const orderById = (id: string) =>
    state.orders.find((order) => order.id === id);

  return {
    contacts: {
      list: async () => clone(state.contacts),
      get: async (id) => clone(contactById(id) || null),
      create: async (input) => {
        const contact: StoredContact = {
          ...clone(input),
          id: randomUUID(),
          createdAt: input.createdAt || new Date().toISOString().slice(0, 10),
        };
        state.contacts.push(contact);
        return clone(contact);
      },
      importBatch: async (inputs: ContactCreateInput[]) => {
        const created = inputs.map((input) => ({
          ...clone(input),
          id: randomUUID(),
          createdAt: input.createdAt || new Date().toISOString().slice(0, 10),
        }));
        state.contacts.push(...created);
        return clone(created);
      },
      update: async (id, patch) => {
        const index = findIndex(state.contacts, id);
        if (index < 0) return null;
        state.contacts[index] = { ...state.contacts[index], ...clone(patch), id };
        return clone(state.contacts[index]);
      },
      removeIfUnreferenced: async (id) => {
        const referenced =
          state.quotations.some((record) => record.contactId === id) ||
          state.orders.some((record) => record.contactId === id);
        if (referenced) {
          throw new BusinessError(
            "CONFLICT",
            "客户已关联报价或订单，不能删除",
            409,
          );
        }
        const index = findIndex(state.contacts, id);
        if (index < 0) return false;
        state.contacts.splice(index, 1);
        return true;
      },
    },
    products: {
      list: async () => clone(state.products),
      get: async (id) =>
        clone(state.products.find((product) => product.id === id) || null),
      create: async (input) => {
        const product: StoredProduct = { ...clone(input), id: randomUUID() };
        state.products.push(product);
        return clone(product);
      },
    },
    inquiries: {
      list: async () => clone(state.inquiries),
      get: async (id) =>
        clone(state.inquiries.find((inquiry) => inquiry.id === id) || null),
      create: async (input) => {
        if (input.contactId && !contactById(input.contactId)) {
          throw new BusinessError("NOT_FOUND", "关联客户不存在", 404);
        }
        const inquiry: StoredInquiry = {
          ...clone(input),
          id: randomUUID(),
          status: "pending",
          aiReply: "",
          createdAt: new Date().toISOString().slice(0, 10),
        };
        state.inquiries.push(inquiry);
        return clone(inquiry);
      },
      update: async (id, patch) => {
        const index = findIndex(state.inquiries, id);
        if (index < 0) return null;
        state.inquiries[index] = { ...state.inquiries[index], ...clone(patch), id };
        return clone(state.inquiries[index]);
      },
    },
    quotations: {
      list: async () =>
        clone(
          state.quotations.map((quotation) => ({
            ...quotation,
            orderId:
              state.orders.find((order) => order.quotationId === quotation.id)
                ?.id || null,
          })),
        ),
      get: async (id) => clone(quotationById(id) || null),
      create: async (input) => {
        const contact = contactById(input.contactId);
        if (!contact) throw new BusinessError("NOT_FOUND", "客户不存在", 404);
        const items = input.items.map((item) => {
          const amount =
            Math.round(Number(item.quantity) * Number(item.unitPrice || 0) * 100) /
            100;
          return { ...clone(item), amount };
        });
        const quotation: StoredQuotation = {
          id: randomUUID(),
          no: sequenceNo("QTN", state.quotations),
          contactId: contact.id,
          contactName: contact.name,
          items,
          totalAmount:
            Math.round(
              items.reduce((sum, item) => sum + Number(item.amount || 0), 0) *
                100,
            ) / 100,
          currency: input.currency,
          tradeTerm: input.tradeTerm,
          status: "draft",
          aiGenerated: input.aiGenerated,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        state.quotations.push(quotation);
        return clone(quotation);
      },
      updateStatus: async (id, status) => {
        const index = findIndex(state.quotations, id);
        if (index < 0) throw new BusinessError("NOT_FOUND", "报价不存在", 404);
        if (state.orders.some((order) => order.quotationId === id)) {
          throw new BusinessError("CONFLICT", "已转为订单的报价不能修改", 409);
        }
        state.quotations[index] = { ...state.quotations[index], status };
        return clone(state.quotations[index]);
      },
    },
    orders: {
      list: async () => clone(state.orders),
      get: async (id) => clone(orderById(id) || null),
      createFromQuotation: async (input) => {
        const quotation = quotationById(input.quotationId);
        if (!quotation) throw new BusinessError("NOT_FOUND", "报价不存在", 404);
        if (quotation.status !== "accepted") {
          throw new BusinessError("CONFLICT", "只有已接受报价才能创建订单", 409);
        }
        if (state.orders.some((order) => order.quotationId === quotation.id)) {
          throw new BusinessError("CONFLICT", "该报价已创建订单", 409);
        }
        const contact = contactById(quotation.contactId);
        if (!contact) throw new BusinessError("NOT_FOUND", "客户不存在", 404);
        const order: StoredOrder = {
          id: randomUUID(),
          no: sequenceNo("ORD", state.orders),
          contactId: contact.id,
          contactName: contact.name,
          quotationId: quotation.id,
          items: clone(quotation.items),
          totalAmount: quotation.totalAmount,
          currency: quotation.currency,
          status: "confirmed",
          deliveryDate: input.deliveryDate,
          progressPercent: 0,
          tradeTerm: quotation.tradeTerm,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        state.orders.push(order);
        return clone(order);
      },
      update: async (id, patch) => {
        const index = findIndex(state.orders, id);
        if (index < 0) return null;
        state.orders[index] = { ...state.orders[index], ...clone(patch), id };
        return clone(state.orders[index]);
      },
    },
    shipments: {
      list: async () => clone(state.shipments),
      get: async (id) =>
        clone(state.shipments.find((shipment) => shipment.id === id) || null),
      create: async (input) => {
        const order = orderById(input.orderId);
        if (!order) throw new BusinessError("NOT_FOUND", "订单不存在", 404);
        if (["cancelled", "completed"].includes(order.status)) {
          throw new BusinessError("CONFLICT", "当前订单不能创建物流记录", 409);
        }
        if (state.shipments.some((shipment) => shipment.orderId === order.id)) {
          throw new BusinessError("CONFLICT", "该订单已有物流记录", 409);
        }
        const shipment: StoredShipment = {
          ...clone(input),
          id: randomUUID(),
          orderNo: order.no,
          customer: order.contactName,
          status: "booked",
          createdAt: new Date().toISOString(),
        };
        state.shipments.push(shipment);
        return clone(shipment);
      },
      advanceStatus: async (id, status) => {
        const index = findIndex(state.shipments, id);
        if (index < 0) throw new BusinessError("NOT_FOUND", "物流记录不存在", 404);
        const statuses: StoredShipment["status"][] = [
          "booked",
          "departed",
          "in_transit",
          "delivered",
        ];
        const shipment = state.shipments[index];
        if (statuses.indexOf(status) < statuses.indexOf(shipment.status)) {
          throw new BusinessError("CONFLICT", "物流状态不能回退", 409);
        }
        const orderIndex = findIndex(state.orders, shipment.orderId);
        if (orderIndex < 0) throw new BusinessError("CONFLICT", "关联订单不存在", 409);
        state.shipments[index] = { ...shipment, status };
        if (["departed", "in_transit"].includes(status)) {
          state.orders[orderIndex] = {
            ...state.orders[orderIndex],
            status: "shipped",
            progressPercent: 100,
          };
        } else if (status === "delivered") {
          state.orders[orderIndex] = {
            ...state.orders[orderIndex],
            status: "completed",
            progressPercent: 100,
          };
        }
        return clone(state.shipments[index]);
      },
      remove: async (id) => {
        const index = findIndex(state.shipments, id);
        if (index < 0) return false;
        state.shipments.splice(index, 1);
        return true;
      },
    },
    documents: {
      list: async () => clone(state.documents),
      get: async (id) =>
        clone(state.documents.find((document) => document.id === id) || null),
      listByOrder: async (orderId) =>
        clone(state.documents.filter((document) => document.orderId === orderId)),
      generateForOrder: async (orderId, types) => {
        const order = orderById(orderId);
        if (!order) throw new BusinessError("NOT_FOUND", "订单不存在", 404);
        const results: StoredDocument[] = [];
        for (const type of types) {
          let document = state.documents.find(
            (record) => record.orderId === order.id && record.type === type,
          );
          if (document) {
            document.status = "generated";
          } else {
            document = {
              id: randomUUID(),
              orderId: order.id,
              orderNo: order.no,
              type,
              status: "generated",
              createdAt: new Date().toISOString().slice(0, 10),
            };
            state.documents.push(document);
          }
          results.push(clone(document));
        }
        return results;
      },
      remove: async (id) => {
        const index = findIndex(state.documents, id);
        if (index < 0) return false;
        state.documents.splice(index, 1);
        return true;
      },
    },
    dashboard: {
      snapshot: async () =>
        clone({
          contacts: state.contacts,
          products: state.products,
          inquiries: state.inquiries,
          quotations: state.quotations,
          orders: state.orders,
        }),
    },
  };
}

export function createMemoryRepositoryFactory(
  options: MemoryRepositoryOptions = {},
) {
  const states = new Map<string, DemoBusinessData>();
  const seedDemo = options.seedDemo !== false;

  return {
    async forTenant(context: BusinessContext) {
      let state = states.get(context.companyId);
      if (!state) {
        state =
          seedDemo && context.companyId === DEMO_COMPANY_ID
            ? snapshotDemoBusinessData()
            : emptyState();
        states.set(context.companyId, state);
      }
      return createTenantRepository(state);
    },
  };
}

export const memoryRepositoryFactory = createMemoryRepositoryFactory();
