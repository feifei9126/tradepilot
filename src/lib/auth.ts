import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { applyAccountSessionState, usableSessionClaims } from "@/lib/auth-session";

class LoginServiceUnavailable extends CredentialsSignin {
  code = "service_unavailable";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        if (email.length > 320 || password.length > 128) return null;
        // Keep database drivers out of the proxy module initialization. Next may
        // emit async exports for them, which Workerd cannot load via the proxy.
        const { reserveLoginAttempt, finishLoginAttempt } = await import("@/lib/login-security");
        const { verifyDeploymentAdmin } = await import("@/lib/account");
        const { findUserByCredentials } = await import("@/lib/registration");
        // Fail closed on a missing/unavailable shared database; no in-memory fallback.
        let attempt;
        try { attempt = await reserveLoginAttempt(email, request); } catch { throw new LoginServiceUnavailable(); }
        if (!attempt.allowed) return null;
        let configured;
        try { configured = await verifyDeploymentAdmin(email, password); } catch { await finishLoginAttempt(attempt, false).catch(() => {}); throw new LoginServiceUnavailable(); }
        if (configured) {
          try { await finishLoginAttempt(attempt, true); } catch { throw new LoginServiceUnavailable(); }
          return {
            id: "deployment-admin",
            email: configured.email,
            name: configured.name,
            companyId: "deployment-workspace",
            role: "owner",
            sessionVersion: configured.sessionVersion,
            isDeploymentWorkspace: true,
            isPlatformAdmin: true,
            mustChangePassword: configured.mustChangePassword,
          };
        }
        const deploymentEmail = process.env.TRADEPILOT_ADMIN_EMAIL?.trim().toLowerCase() || "";
        if (email === deploymentEmail) { await finishLoginAttempt(attempt, false).catch(() => {}); return null; } // Never let a seeded DB password bypass an overridden admin password.

        const user = await findUserByCredentials(email, password);
        try { await finishLoginAttempt(attempt, Boolean(user)); } catch { throw new LoginServiceUnavailable(); }
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          role: user.role,
          sessionVersion: user.sessionVersion,
          isDeploymentWorkspace: user.isDeploymentWorkspace,
          isPlatformAdmin: user.isPlatformAdmin,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.companyId = user.companyId;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion || "0";
        token.isDeploymentWorkspace = user.isDeploymentWorkspace ?? false;
        token.isPlatformAdmin = user.isPlatformAdmin ?? false;
        token.mustChangePassword = user.mustChangePassword ?? false;
        token.invalidated = false;
        token.databaseUnavailable = false;
      } else if (token.sub) {
        const { getAuthSessionState } = await import("@/lib/account");
        const state = await getAuthSessionState(token.sub, typeof token.sessionVersion === "string" ? token.sessionVersion : "0");
        applyAccountSessionState(token, state);
      }
      if (trigger === "update" && token.sub && !token.invalidated && !token.databaseUnavailable) {
        const { getAccountProfile } = await import("@/lib/account");
        const profile = await getAccountProfile(token.sub);
        token.name = profile.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, usableSessionClaims(token));
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      options: {
        secure:
          process.env.NODE_ENV === "production" &&
          (process.env.AUTH_URL || process.env.NEXTAUTH_URL)?.startsWith(
            "https://",
          ) === true,
      },
    },
  },
});
