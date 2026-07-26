import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authorizeCredentials } from "@/lib/auth-credentials";
import { authConfig } from "@/lib/auth-config";

export const { handlers, signIn, signOut, auth } = NextAuth(
  Object.assign({}, authConfig, {
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;

          const user = await authorizeCredentials(
            String(credentials.email),
            String(credentials.password),
          );
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
  }),
);
