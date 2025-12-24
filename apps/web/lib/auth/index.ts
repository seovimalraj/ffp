import { getServerSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

async function refreshAccessToken(token: any) {
  try {
    console.log("Attempting to refresh token for user:", token.id);

    // If we don't have a refresh token, mark as error
    if (!token.refreshToken) {
      console.error("No refresh token available");
      throw new Error("No refresh token");
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: token.refreshToken,
        userId: token.id,
      }),
    });

    const refreshedTokens = await res.json();

    if (!res.ok) {
      console.error("Refresh token failed:", res.status, refreshedTokens);
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken,
      accessTokenExpires: Date.now() + 60 * 60 * 1000, // 1 hour
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    // Return token with error flag - this will trigger sign out
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

const authOptions: NextAuthOptions = {
  // Persistent cookie - keeps users logged in after browser close
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days - persistent cookie
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          console.log(process.env.NEST_API);
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            },
          );

          if (!res.ok) {
            console.error("Auth failed:", res.status, res.statusText);
            return null;
          }

          const user = await res.json();
          if (user && user.id) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              organizationId: user.organizationId || user.organization_id,
              refreshToken: user.refreshToken,
            };
          }

          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days (matches refresh token expiry)
  },
  callbacks: {
    async jwt({ token, user, _account }) {
      // Initial sign in: Credentials provider may not provide `account`,
      // so create the token whenever `user` is present.
      if (user) {
        console.log("Initial sign in, creating new token");
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as any).role,
          organizationId:
            (user as any).organizationId || (user as any).organization_id,
          accessToken: (user as any).accessToken,
          refreshToken: (user as any).refreshToken,
          accessTokenExpires: Date.now() + 60 * 60 * 1000, // 1 hour
        };
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to update it
      console.log("Access token expired, attempting refresh");
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (token.error === "RefreshAccessTokenError") {
        // Force sign out if refresh token is invalid
        console.log("Refresh token error detected, user will be signed out");
        session.error = "RefreshAccessTokenError";
        return session;
      }

      console.log(session, token, "<---");

      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
        // Include access token in session if needed for API calls
        (session as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      // Clear refresh token on sign out
      if (token?.id) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: token.id }),
          });
        } catch (error) {
          console.error("Error during logout:", error);
        }
      }
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const getSession = () => getServerSession(authOptions);

const AuthService = {
  login: async (_email: string, _pass: string) => null as any,
  register: async (_data: any) => null as any,
};
const createAuthResponse = (_user: any, _token: string) => ({});
const getUser = async () => null;

export { authOptions, getSession, AuthService, createAuthResponse, getUser };
