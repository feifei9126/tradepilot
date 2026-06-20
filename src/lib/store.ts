// In-memory data store for MVP (swap to PostgreSQL later)
export interface StoredContact {
  id: string; name: string; country?: string; source?: string;
  tags?: string[]; notes?: string; email?: string; phone?: string;
  grade?: "A" | "B" | "C"; stage?: string; persons?: { name: string; position?: string; phone?: string; email?: string; isPrimary?: boolean }[]; activities?: { date: string; type: string; note: string }[]; lastContactedAt?: string; nextFollowUpAt?: string; createdAt: string;
}
export interface StoredProduct {
  stockQuantity?: number;
  lowStockThreshold?: number;
  warehouse?: string;
  id: string; name: string; modelNo?: string; hsCode?: string;
  costPrice?: number; unit: string; moq?: number; category?: string; description?: string;
}
export interface StoredMessage {
  id: string; contactId?: string; contactName: string;
  channel: "whatsapp" | "wechat" | "email" | "other";
  content: string; direction: "in" | "out";
  read: boolean; aiReply?: string; createdAt: string;
}

export interface StoredDocument {
  id: string; orderId: string; orderNo: string; type: string;
  status: "draft" | "generated"; createdAt: string; content?: string;
}


export interface StoredEmail {
  id: string;
  accountId: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  date: string;
  folder: "inbox" | "sent" | "draft" | "trash";
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  attachments?: { name: string; size: number; url: string }[];
  contactId?: string;
  createdAt: string;
}

export interface StoredEmailAccount {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  createdAt: string;
}

export interface StoredSupplier {
  id: string; name: string; contactName?: string; phone?: string; email?: string;
  country?: string; products?: string[]; rating?: number; tags?: string[];
  createdAt: string;
}

export interface StoredInquiry {
  id: string; customer: string; contactId?: string;
  subject: string; content: string; source: string;
  status: "pending" | "quoted" | "converted" | "lost";
  aiReply?: string; createdAt: string;
}
export interface StoredQuotation {
  id: string; no: string; contactId: string; contactName: string;
  items: any[]; totalAmount: number; currency: string;
  tradeTerm: string; status: string; aiGenerated: boolean;
  createdAt: string;
}
export interface StoredOrder {
  id: string; no: string; contactId: string; contactName: string;
  quotationId?: string; items: any[]; totalAmount: number;
  status: string; deliveryDate?: string; progressPercent: number;
  createdAt: string;
}
export interface StoredUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  password: string;
  role: string;
  createdAt: string;
}
export interface StoredCompany {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}



const contacts: StoredContact[] = [
  { id: "c1", name: "BestBuy Co.", country: "美国", source: "alibaba", tags: ["大客�?, "电子"], grade: "A", stage: "converted", persons: [{ name: "John Smith", position: "采购经理", email: "john@bestbuy.com", phone: "+1 555-0123", isPrimary: true }, { name: "Sarah Lee", position: "质量主管", email: "sarah@bestbuy.com" }], activities: [{ date: "2026-05-20", type: "call", note: "讨论Q3订单计划" }, { date: "2026-05-10", type: "meeting", note: "广交会面谈，确认新品打样" }], createdAt: "2026-01-15" },
  { id: "c2", name: "EuroTech GmbH", country: "德国", source: "exhibition", tags: ["优质", "工业"], grade: "B", stage: "negotiating", persons: [{ name: "Hans Mueller", position: "CEO", email: "hans@eurotech.de", phone: "+49 123 456", isPrimary: true }], activities: [{ date: "2026-05-15", type: "email", note: "发送新版产品目�? }], createdAt: "2026-02-20" },
  { id: "c3", name: "Sakura Trading", country: "日本", source: "referral", tags: ["新客�?], createdAt: "2026-03-10" },
  { id: "c4", name: "ABC Imports Ltd", country: "英国", source: "google", tags: ["潜力"], createdAt: "2026-03-22" },
  { id: "c5", name: "XYZ Corporation", country: "加拿�?, source: "alibaba", tags: ["待跟�?], createdAt: "2026-04-01" },
];

const products: StoredProduct[] = [
  { id: "p1", name: "无线蓝牙耳机", modelNo: "BT-E100", hsCode: "8517.62", costPrice: 45, unit: "�?, moq: 500,
    category: "电子产品", description: "高品质蓝�?.3耳机，降噪版，续�?小时，充电仓额外续航24小时。支持多国语言语音提示�? },
  { id: "p2", name: "智能手表 S3", modelNo: "SW-S300", hsCode: "8517.62", costPrice: 120, unit: "�?, moq: 200,
    category: "电子产品", description: "1.43英寸AMOLED屏幕，IP68防水，心�?血�?睡眠监测�?天续航。支持英�?德语/法语/中文/日语/阿拉伯语�? },
  { id: "p3", name: "USB-C 七合一扩展�?, modelNo: "UC-701", hsCode: "8471.80", costPrice: 28, unit: "�?, moq: 1000,
    category: "电脑配件", description: "USB-C 7�?拓展坞：HDMI 4K@60Hz + USB3.0*3 + PD100W + SD/TF + 千兆网口。兼容MacBook/Windows/ChromeOS�? },
  { id: "p4", name: "便携充电�?20000mAh", modelNo: "PB-200", hsCode: "8507.60", costPrice: 65, unit: "�?, moq: 300,
    category: "电子产品", description: "20000mAh大容量，PD65W快充，支持iPhone15-30W/三星25W/Laptop。LED数字电量显示。航空可携带（可登机）�? },
  { id: "p5", name: "LED 台灯", modelNo: "LD-100", hsCode: "9405.20", costPrice: 18, unit: "�?, moq: 2000,
    category: "照明", description: "USB充电LED护眼台灯�?级亮度调节，色温3000K-6500K，续�?-12小时。折叠便携，适合办公/出差�? },
  { id: "p6", name: "蓝牙便携音箱", modelNo: "SP-200", hsCode: "8518.22", costPrice: 32, unit: "�?, moq: 500,
    category: "电子产品", description: "IPX7防水蓝牙音箱�?0W立体声，蓝牙5.2，续�?5小时。支持TWS串联。适合户外/海滩/派对�? },
  { id: "p7", name: "无线鼠标 静音�?, modelNo: "MS-100", hsCode: "8471.60", costPrice: 12, unit: "�?, moq: 1000,
    category: "电脑配件", description: "2.4G+蓝牙双模静音鼠标�?600DPI，type-C充电，兼容Windows/Mac/iPad。超薄便携设计�? },
];

const messages: StoredMessage[] = [
  { id: "m1", contactId: "c1", contactName: "BestBuy Co.", channel: "whatsapp", content: "Hi, we received the samples. Quality looks good. Can you send the PI for 2000pcs?", direction: "in", read: false, createdAt: "2026-06-04" },
  { id: "m2", contactId: "c1", contactName: "BestBuy Co.", channel: "whatsapp", content: "Sure! I will send the PI today. Also, do you need any customization on the packaging?", direction: "out", read: true, createdAt: "2026-06-04" },
  { id: "m3", contactId: "c2", contactName: "EuroTech GmbH", channel: "wechat", content: "请问智能手表 S3 的德语系统什么时候可以支持？客户在催了�?, direction: "in", read: false, aiReply: "Dear customer, the German language update for Smart Watch S3 is scheduled for next week. We will inform you once it is ready.", createdAt: "2026-06-03" },
  { id: "m4", contactId: "c3", contactName: "Sakura Trading", channel: "whatsapp", content: "Sample request for USB-C Hub - please send to our Tokyo office.", direction: "in", read: true, createdAt: "2026-06-02" },
  { id: "m5", contactName: "New Inquiry - ABC Trading", channel: "email", content: "We are interested in your Portable Power Bank 20000mAh. Please quote FOB Shenzhen.", direction: "in", read: false, createdAt: "2026-06-05" },
];

const documents: StoredDocument[] = [
  { id: "d1", orderId: "o1", orderNo: "ORD-2026-088", type: "commercial_invoice", status: "generated", createdAt: "2026-06-01" },
  { id: "d2", orderId: "o1", orderNo: "ORD-2026-088", type: "packing_list", status: "generated", createdAt: "2026-06-01" },
  { id: "d3", orderId: "o2", orderNo: "ORD-2026-089", type: "proforma_invoice", status: "draft", createdAt: "2026-05-28" },
];

const suppliers: StoredSupplier[] = [
  { id: "s1", name: "深圳华强电子科技有限公司", contactName: "张�?, phone: "0755-88886666", country: "中国", products: ["蓝牙芯片", "传感�?], rating: 5, tags: ["核心供应�?, "交期稳定"], createdAt: "2025-01-10" },
  { id: "s2", name: "东莞精工塑胶模具�?, contactName: "李厂�?, phone: "0769-88881234", country: "中国", products: ["塑胶外壳", "模具"], rating: 4, tags: ["长期合作"], createdAt: "2025-03-15" },
  { id: "s3", name: "广州顺丰物流国际�?, contactName: "王经�?, email: "wang@sf-express.com", country: "中国", products: ["国际空运", "海运"], rating: 3, tags: ["物流"], createdAt: "2025-05-20" },
];

const inquiries: StoredInquiry[] = [
  { id: "i1", customer: "BestBuy Co.", contactId: "c1", subject: "2000�?BT-E100 报价", content: "We are interested in purchasing 2000 pieces of BT-E100. Please send us your best price.", source: "邮件", status: "pending", createdAt: "2026-06-01" },
  { id: "i2", customer: "EuroTech GmbH", contactId: "c2", subject: "智能手表 S3 询盘", content: "请问智能手表 S3 是否支持德语系统？我们想做欧洲代理�?, source: "WhatsApp", status: "pending", createdAt: "2026-05-28" },
  { id: "i3", customer: "Sakura Trading", contactId: "c3", subject: "USB-C 扩展坞样品申�?, content: "We'd like to order samples of the USB-C Hub for testing.", source: "阿里巴巴", status: "pending", createdAt: "2026-05-25" },
  { id: "i4", customer: "ABC Imports Ltd", contactId: "c4", subject: "充电宝批发询�?, content: "请报�?20000mAh 充电�?500件的 FOB 价格�?, source: "谷歌", status: "pending", createdAt: "2026-05-20" },
];

const quotations: StoredQuotation[] = [
  { id: "q1", no: "QTN-2026-001", contactId: "c1", contactName: "BestBuy Co.", items: [{ productName: "无线蓝牙耳机", quantity: 1000, unit: "�?, unitPrice: 12.5, amount: 12500 }], totalAmount: 12500, currency: "USD", tradeTerm: "FOB", status: "sent", aiGenerated: true, createdAt: "2026-05-20" },
  { id: "q2", no: "QTN-2026-002", contactId: "c2", contactName: "EuroTech GmbH", items: [{ productName: "智能手表 S3", quantity: 500, unit: "�?, unitPrice: 35.0, amount: 17500 }], totalAmount: 17500, currency: "USD", tradeTerm: "CIF", status: "draft", aiGenerated: true, createdAt: "2026-05-25" },
  { id: "q3", no: "QTN-2026-003", contactId: "c3", contactName: "Sakura Trading", items: [{ productName: "USB-C 七合一扩展�?, quantity: 200, unit: "�?, unitPrice: 8.0, amount: 1600 }], totalAmount: 1600, currency: "USD", tradeTerm: "EXW", status: "accepted", aiGenerated: false, createdAt: "2026-05-15" },
];
const bindings: Record<string, { channel: string; phone: string; deviceId: string; boundAt: string }> = {};

const autoReplyConfig: Record<string, { enabled: boolean; language: string }> = {
  'c1': { enabled: true, language: 'en' },
  'c2': { enabled: false, language: 'zh' },
};

const tasks: { id: string; title: string; done: boolean; contactName?: string; dueDate?: string }[] = [
  { id: 't1', title: '跟进 BestBuy 样品确认', done: false, contactName: 'BestBuy Co.', dueDate: '2026-06-10' },
  { id: 't2', title: '准备 EuroTech 报价�?, done: false, contactName: 'EuroTech GmbH', dueDate: '2026-06-08' },
  { id: 't3', title: '完成 Sakura 订单出货', done: false, contactName: 'Sakura Trading', dueDate: '2026-06-15' },
];

const orders: StoredOrder[] = [
  { id: "o1", no: "ORD-2026-088", contactId: "c1", contactName: "BestBuy Co.", quotationId: "q1", items: [{ productName: "无线蓝牙耳机", quantity: 1000, unit: "�?, unitPrice: 12.5, amount: 12500 }], totalAmount: 12500, status: "in_production", deliveryDate: "2026-06-20", progressPercent: 70, createdAt: "2026-05-22" },
  { id: "o2", no: "ORD-2026-089", contactId: "c2", contactName: "EuroTech GmbH", quotationId: "q2", items: [{ productName: "智能手表 S3", quantity: 500, unit: "�?, unitPrice: 35.0, amount: 17500 }], totalAmount: 17500, status: "confirmed", deliveryDate: "2026-07-05", progressPercent: 20, createdAt: "2026-05-28" },
  { id: "o3", no: "ORD-2026-090", contactId: "c3", contactName: "Sakura Trading", quotationId: "q3", items: [{ productName: "USB-C 七合一扩展�?, quantity: 200, unit: "�?, unitPrice: 8.0, amount: 1600 }], totalAmount: 1600, status: "shipped", deliveryDate: "2026-06-01", progressPercent: 100, createdAt: "2026-05-18" },
];

let nextQuoteNo = 1;
let nextOrderNo = 1;
const users: StoredUser[] = [];
const companies: StoredCompany[] = [];


export const store = {
  contacts: { list: () => contacts, get: (id: string) => contacts.find(c => c.id === id), add: (c: StoredContact) => contacts.push(c), update: (id: string, data: Partial<StoredContact>) => { const idx = contacts.findIndex(c => c.id === id); if (idx >= 0) { contacts[idx] = { ...contacts[idx], ...data }; return contacts[idx]; } return null; }, delete: (id: string) => { const idx = contacts.findIndex(c => c.id === id); if (idx >= 0) { contacts.splice(idx, 1); return true; } return false; } },
  products: { list: () => products, get: (id: string) => products.find(p => p.id === id), add: (p: StoredProduct) => products.push(p) },
  quotations: {
    list: () => quotations,
    get: (id: string) => quotations.find(q => q.id === id),
    add: (q: StoredQuotation) => { quotations.push(q); return q; },
    nextNo: () => { const n = `QTN-2026-${String(nextQuoteNo++).padStart(3, '0')}`; return n; },
  },
  orders: {
    list: () => orders,
    get: (id: string) => orders.find(o => o.id === id),
    add: (o: StoredOrder) => { orders.push(o); return o; },
    update: (id: string, data: Partial<StoredOrder>) => {
      const idx = orders.findIndex(o => o.id === id);
      if (idx >= 0) { orders[idx] = { ...orders[idx], ...data }; return orders[idx]; }
      return null;
    },
    nextNo: () => { const n = `ORD-2026-${String(nextOrderNo++).padStart(3, '0')}`; return n; },
  },
  tasks: { list: () => tasks, add: (t: any) => tasks.push(t), toggle: (id: string) => { const t = tasks.find((x: any) => x.id === id); if (t) t.done = !t.done; }, delete: (id: string) => { const idx = tasks.findIndex((x: any) => x.id === id); if (idx >= 0) tasks.splice(idx, 1); } },
  autoReply: { get: (id: string) => { return autoReplyConfig[id] || { enabled: false, language: 'en' }; }, set: (id: string, cfg: any) => { autoReplyConfig[id] = cfg; } },
  bindings: { get: (phone: string) => { const b = (global as any).__bindings?.[phone]; return b || null; }, set: (phone: string, data: any) => { (global as any).__bindings = (global as any).__bindings || {}; (global as any).__bindings[phone] = data; }, getAll: () => { return Object.values((global as any).__bindings || {}); }, remove: (phone: string) => { const b = (global as any).__bindings; if (b) delete b[phone]; } },
  messages: {
    list: () => messages,
    get: (id: string) => messages.find(m => m.id === id),
    add: (m: StoredMessage) => { messages.push(m); return m; },
    byContact: (name: string) => messages.filter(m => m.contactName === name),
    unreadCount: (ch: string) => messages.filter(m => !m.read && (!ch || m.channel === ch)).length,
    markRead: (id: string) => { const m = messages.find((x: any) => x.id === id); if (m) m.read = true; },
  },
  documents: {
    list: () => documents,
    get: (id: string) => documents.find(d => d.id === id),
    add: (d: StoredDocument) => { documents.push(d); return d; },
    byOrder: (orderId: string) => documents.filter(d => d.orderId === orderId),
    remove: (id: string) => { const idx = documents.findIndex((d: any) => d.id === id); if (idx >= 0) { documents.splice(idx, 1); return true; } return false; },
  },
  suppliers: {
    list: () => suppliers,
    get: (id: string) => suppliers.find(s => s.id === id),
    add: (s: StoredSupplier) => { suppliers.push(s); return s; },
  },
  inquiries: {
    list: () => inquiries,
    get: (id: string) => inquiries.find(i => i.id === id),
    add: (i: StoredInquiry) => { inquiries.push(i); return i; },
    update: (id: string, data: Partial<StoredInquiry>) => {
      const idx = inquiries.findIndex(i => i.id === id);
      if (idx >= 0) { inquiries[idx] = { ...inquiries[idx], ...data }; return inquiries[idx]; }
      return null;
    },
  },
  // Registration
  users: {
    create: (user: StoredUser) => { users.push(user); return user; },
    findByEmail: (email: string) => users.find(u => u.email === email),
    findById: (id: string) => users.find(u => u.id === id),
  },
  companies: {
    create: (company: StoredCompany) => { companies.push(company); return company; },
    findByName: (name: string) => companies.find(c => c.name === name),
    findById: (id: string) => companies.find(c => c.id === id),
    findBySlug: (slug: string) => companies.find(c => c.slug === slug),
  },
  validateCredentials: (email: string, password: string): StoredUser | null => {
    if (email == 'demo@tradepilot.dev' && password == 'password') {
      return { id: '1', companyId: '1', email, name: 'Demo User', password: '', role: 'owner', createdAt: new Date().toISOString() };
    }
    const user = users.find(u => u.email === email && u.password === password);
    return user || null;
  },

};

