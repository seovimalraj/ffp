import { getServerSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { NextResponse } from "next/server";

async function refreshAccessToken(token: any) {
  try {
    console.log("Attempting to refresh token for user:", token.id);

    // If we don't have a refresh token, mark as error
    if (!token.refreshToken) {
      console.error("No refresh token available");
      throw new Error("No refresh token");
    }

    // Use internal API URL for server-side calls
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const res = await fetch(`${apiUrl}/auth/refresh`, {
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
          // Use internal API URL for server-side calls
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
          console.log('Auth API URL:', apiUrl);
          const res = await fetch(
            `${apiUrl}/auth/login`,
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
    async jwt({ token, user }) {
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
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
          await fetch(`${apiUrl}/auth/logout`, {
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
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const getSession = () => getServerSession(authOptions);

const AuthService = {
  login: async (email: string, pass: string) => {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    return res.json();
  },
  register: async (data: any) => {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const res = await fetch(
      `${apiUrl}/auth/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Registration failed");
    }
    const result = await res.json();
    return {
      user: result,
      token: result.accessToken,
    };
  },
};

const createAuthResponse = (user: any, token: string) => {
  return NextResponse.json(user, {
    headers: {
      "Set-Cookie": `next-auth.session-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
    },
  });
};

const getUser = async () => {
  const session = await getSession();
  return session?.user;
};

export { authOptions, getSession, AuthService, createAuthResponse, getUser };
