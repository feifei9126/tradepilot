// In-memory user & company store (separate from main store to avoid encoding issues)
export interface StoredUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  password: string; // hashed
  role: string;
  createdAt: string;
}
export interface StoredCompany {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

const users: StoredUser[] = [];
const companies: StoredCompany[] = [];

export const userStore = {
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
    if (email === "demo@tradepilot.dev" && password === "password") {
      return { id: "1", companyId: "1", email, name: "Demo User", password: "", role: "owner", createdAt: new Date().toISOString() };
    }
    const user = users.find(u => u.email === email && u.password === password);
    return user || null;
  },
};
