import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const developmentEmail = "demo@tradepilot.dev";
const developmentPassword = "password";

function configuredCredentials() {
  const development = process.env.NODE_ENV !== "production";
  return {
    email: process.env.TRADEPILOT_ADMIN_EMAIL || (development ? developmentEmail : ""),
    password: process.env.TRADEPILOT_ADMIN_PASSWORD || (development ? developmentPassword : ""),
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const configured = configuredCredentials();
        if (!configured.email || !configured.password) {
          console.error("Production login is disabled: TRADEPILOT_ADMIN_EMAIL and TRADEPILOT_ADMIN_PASSWORD are required.");
          return null;
        }
        if (credentials.email === configured.email && credentials.password === configured.password) {
          return {
            id: "1",
            email: configured.email,
            name: "TradePilot Admin",
            companyId: "1",
            role: "owner",
          };
        }
        return null;
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
    sessionToken: { options: { secure: process.env.NODE_ENV === "production" && process.env.AUTH_URL?.startsWith("https://") === true } },
  },
});
