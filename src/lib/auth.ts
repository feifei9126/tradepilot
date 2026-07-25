import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { findUserByCredentials } from "@/lib/registration";

const developmentEmail = "demo@tradepilot.dev";
const developmentPassword = "12345678";

function configuredCredentials() {
  const development = process.env.NODE_ENV !== "production";
  return {
    email:
      process.env.TRADEPILOT_ADMIN_EMAIL ||
      (development ? developmentEmail : ""),
    password:
      process.env.TRADEPILOT_ADMIN_PASSWORD ||
      (development ? developmentPassword : ""),
  };
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const configured = configuredCredentials();

        if (
          configured.email &&
          configured.password &&
          email === configured.email.trim().toLowerCase() &&
          password === configured.password
        ) {
          return {
            id: "deployment-admin",
            email: configured.email,
            name: "TradePilot Admin",
            companyId: "deployment-workspace",
            role: "owner",
          };
        }

        const user = await findUserByCredentials(email, password);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.companyId = user.companyId;
        token.role = user.role;
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
});
