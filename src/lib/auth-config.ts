import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.companyId = user.companyId;
        token.role = user.role;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const update = session as {
          companyId?: unknown;
          role?: unknown;
          user?: { companyId?: unknown; role?: unknown };
        };
        const companyId = update.companyId ?? update.user?.companyId;
        const role = update.role ?? update.user?.role;
        if (typeof companyId === "string") token.companyId = companyId;
        if (typeof role === "string") token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.companyId = token.companyId as string;
        session.user.role = token.role as string;
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
} satisfies NextAuthConfig;
