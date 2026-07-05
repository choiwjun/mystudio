import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { validateOwnerCredentials } from "@/lib/auth/owner";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const result = await validateOwnerCredentials({
          email: String(credentials?.email ?? ""),
          password: String(credentials?.password ?? ""),
        });

        if (!result.ok) {
          return null;
        }

        return {
          id: "owner",
          email: result.email,
          name: "Owner",
        };
      },
    }),
  ],
});
