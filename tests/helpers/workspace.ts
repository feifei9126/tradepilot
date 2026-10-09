/** Explicit unit-test fixture only. Never imported by production code.
 * This adapter verifies route validation/workflow, NOT PostgreSQL isolation,
 * locks or foreign keys. Those require the database integration test suite. */
import { randomUUID } from "node:crypto";
import test, { type TestContext } from "node:test";
import type { PoolClient } from "pg";
import { CrmRepository, CrmError, type RecordKind } from "../../src/lib/crm-repository";
import { store as legacySeeds } from "../../src/lib/store";
import { runInWorkspace } from "../../src/lib/workspace-context";

type RecordData = { id: string };
class UnitRepository extends CrmRepository {
  private records = new Map<RecordKind, Map<string, RecordData>>();
  private counters = new Map<RecordKind, number>();
  readonly events: { action: string; targetId?: string }[] = [];
  constructor() {
    super(randomUUID(), "unit-owner", { role: "owner" });
    for (const kind of ["contacts", "products", "inquiries", "quotations", "orders", "shipments", "documents", "messages", "suppliers", "tasks"] as const) {
      for (const record of legacySeeds[kind].list()) this.bucket(kind).set(record.id, structuredClone(record));
    }
  }
  private bucket(kind: RecordKind) {
    let bucket = this.records.get(kind);
    if (!bucket) { bucket = new Map(); this.records.set(kind, bucket); }
    return bucket;
  }
  override async read<T extends RecordData>(kind: RecordKind, id: string): Promise<T | undefined> {
    return structuredClone(this.bucket(kind).get(id)) as T | undefined;
  }
  override async write<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const previous = structuredClone(this.records);
    const client = { query: async () => { throw new Error("Unexpected SQL in a unit fixture. Use a real PostgreSQL integration test."); } } as unknown as PoolClient;
    try { return await fn(client); }
    catch (error) { this.records = previous; throw error; }
  }
  override async save<T extends RecordData>(_client: PoolClient, kind: RecordKind, data: T, insert: boolean): Promise<T> {
    if (insert && this.bucket(kind).has(data.id)) throw new CrmError("记录重复", 409);
    this.bucket(kind).set(data.id, structuredClone(data));
    return structuredClone(data);
  }
  override async list<T extends RecordData>(kind: RecordKind): Promise<T[]> {
    return structuredClone([...this.bucket(kind).values()]) as T[];
  }
  override collection<T extends RecordData>(kind: RecordKind) {
    const list = () => this.list<T>(kind);
    const updateWith = async (id: string, transform: (current: T) => T): Promise<T | null> => {
      const current = await this.read<T>(kind, id);
      if (!current) return null;
      return this.save({} as PoolClient, kind, { ...transform(current), id }, false);
    };
    const remove = async (id: string) => this.bucket(kind).delete(id);
    return {
      list, get: (id: string) => this.read<T>(kind, id),
      add: (data: T) => this.save({} as PoolClient, kind, data, true),
      update: (id: string, patch: Partial<T>) => updateWith(id, current => ({ ...current, ...patch })),
      updateWith, delete: remove, remove,
      nextNo: async () => {
        const value = (this.counters.get(kind) ?? 0) + 1; this.counters.set(kind, value);
        return `UNIT-${kind}-${value}`;
      },
    };
  }
  override async auditIn(_client: PoolClient, action: string, targetId?: string) { this.events.push({ action, targetId }); }
  override async audit(_actorId: string, action: string, targetId?: string) { this.events.push({ action, targetId }); }
}
export function workspaceTest(name: string, fn: (context: TestContext, repository: CrmRepository) => unknown | Promise<unknown>) {
  return test(name, async context => {
    const repository = new UnitRepository();
    await runInWorkspace({ companyId: repository.companyId, userId: repository.actorId, role: "owner", isPlatformAdmin: false, store: repository }, () => fn(context, repository));
  });
}
