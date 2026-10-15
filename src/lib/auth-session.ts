import type { JWT } from "next-auth/jwt";
import type { AuthSessionState } from "./account";

/** A database outage removes usable session claims, but is not a revocation.
 * Only a successful authoritative recheck may restore access. A revoked token
 * stays revoked even after an account/workspace is enabled again. */
export function applyAccountSessionState(token: JWT, state: AuthSessionState): JWT {
  if (token.invalidated) {
    token.databaseUnavailable = false;
    return token;
  }
  token.databaseUnavailable = state.databaseUnavailable === true;
  if (token.databaseUnavailable) return token;
  if (!state.active) {
    token.invalidated = true;
    return token;
  }
  token.name = state.name || token.name;
  token.companyId = state.companyId;
  token.role = state.role || "member";
  token.isDeploymentWorkspace = state.isDeploymentWorkspace === true;
  token.isPlatformAdmin = state.isPlatformAdmin === true;
  token.mustChangePassword = state.mustChangePassword === true;
  return token;
}

export function usableSessionClaims(token: JWT) {
  const usable = !token.invalidated && !token.databaseUnavailable;
  return {
    id: usable ? token.sub || "" : "",
    companyId: usable ? token.companyId : undefined,
    role: usable ? token.role : undefined,
    isDeploymentWorkspace: usable && token.isDeploymentWorkspace === true,
    isPlatformAdmin: usable && token.isPlatformAdmin === true,
    mustChangePassword: usable && token.mustChangePassword === true,
    databaseUnavailable: token.databaseUnavailable === true,
  };
}
