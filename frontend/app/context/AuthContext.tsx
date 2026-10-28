"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User, AuthContextValue } from "@/app/types/auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getXsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)XSRF-TOKEN=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsAuthenticated(true);
        setError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string, remember = false): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    try {
      // Ensure CSRF cookie exists
      let csrfToken = getXsrfToken();
      if (!csrfToken) {
        try {
          await fetch("/api/auth/csrf", { credentials: "include" });
          csrfToken = getXsrfToken();
        } catch {
          // fallback to standard request
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (csrfToken) {
        headers["X-XSRF-TOKEN"] = csrfToken;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ email, password, remember }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.message || "Login failed. Please check your credentials.";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection error. Unable to reach server.";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const csrfToken = getXsrfToken();
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (csrfToken) {
        headers["X-XSRF-TOKEN"] = csrfToken;
      }

      await fetch("/api/auth/logout", {
        method: "POST",
        headers,
        credentials: "include",
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
