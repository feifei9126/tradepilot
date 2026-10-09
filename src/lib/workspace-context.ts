import { AsyncLocalStorage } from "node:async_hooks";
import type { CrmRepository } from "./crm-repository";

export type WorkspaceContext = { companyId: string; userId: string; role: string; teamId?: string; isPlatformAdmin: boolean; store: CrmRepository };
const context = new AsyncLocalStorage<WorkspaceContext>();
export const runInWorkspace = <T>(workspace: WorkspaceContext, fn: () => T): T => context.run(workspace, fn);
export function currentWorkspace() { return context.getStore(); }
export function getStore() {
  const workspace = currentWorkspace();
  if (!workspace) throw new Error("Business repository requires an authenticated workspace context");
  return workspace.store;
}
