import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config (no Node.js APIs like bcrypt)
// Used by middleware.ts
export const authConfig: NextAuthConfig = {
  providers: [], // providers added in auth.ts (Node.js only)
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username?: string }).username;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.username = token.username as string;
      session.user.role = token.role as string;
      return session;
    },
  },
  session: { strategy: "jwt" },
};
