"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getSession, signIn, signOut } from "next-auth/react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "engineer" | "buyer" | "security_analyst";
  org?: {
    id: string;
    name: string;
    domain?: string;
  };
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    company?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.name || "",
          role: session.user.role as User["role"],
          org: session.user.organizationId
            ? { id: session.user.organizationId, name: "" }
            : undefined,
          avatar: undefined,
        });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        return { success: false, error: result.error };
      }

      await checkAuth();
      return { success: true };
    } catch (_error) {
      return { success: false, error: "Network error" };
    }
  };

  const register = async (registerData: {
    email: string;
    password: string;
    name: string;
    company?: string;
  }) => {
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (response.ok) {
        // Ensure a NextAuth session exists after registration
        await signIn("credentials", {
          redirect: false,
          email: registerData.email,
          password: registerData.password,
        });
        await checkAuth();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (_error) {
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await signOut({ redirect: false, callbackUrl: "/signin" });
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return default values when AuthProvider is not available (e.g., during static generation)
    return {
      user: null,
      loading: false,
      login: async () => ({ success: false, error: "Auth not available" }),
      register: async () => ({ success: false, error: "Auth not available" }),
      logout: async () => {},
    };
  }
  return context;
}
