"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  initKeycloak,
  login,
  logout,
  getToken,
  updateToken,
} from "@/lib/keycloak";

interface AuthContextType {
  authenticated: boolean;
  keycloak: any;
  login: () => void;
  logout: () => void;
  getToken: () => string | undefined;
  updateToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [keycloak, setKeycloak] = useState<any>(null);

  useEffect(() => {
    const initializeKeycloak = async () => {
      try {
        const { authenticated: isAuth, keycloak: kc } = await initKeycloak();
        setAuthenticated(isAuth);
        setKeycloak(kc);

        // Set up token refresh
        if (isAuth) {
          setInterval(async () => {
            try {
              await updateToken();
            } catch (error) {
              console.error("Token refresh failed:", error);
              // If token refresh fails, logout
              logout();
            }
          }, 60000); // Refresh every minute
        }
      } catch (error) {
        console.error("Keycloak initialization failed:", error);
      }
    };

    initializeKeycloak();
  }, []);

  const value = {
    authenticated,
    keycloak,
    login,
    logout,
    getToken,
    updateToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
