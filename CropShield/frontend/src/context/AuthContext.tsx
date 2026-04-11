'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, loginAdmin as loginAdminApi, loginFarmerWithGoogleCredential as loginFarmerApi, loginDemoFarmer as loginDemoFarmerApi } from '@/lib/api';
import type { AuthUserClaims } from '@/types/api';

export type UserRole = 'admin' | 'farmer';

export interface AuthUser {
  role: UserRole;
  name: string;
  email?: string;
  picture?: string;
}

  interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginFarmerWithGoogleCredential: (credential: string) => Promise<{ success: boolean; message?: string }>;
  loginDemoFarmer: (email: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const TOKEN_STORAGE_KEY = 'cropshield_token';
const AuthContext = createContext<AuthContextType | null>(null);

function decodeJwtPayload(token: string): AuthUserClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as AuthUserClaims;
  } catch {
    return null;
  }
}

function buildUserFromClaims(payload: AuthUserClaims | null): AuthUser | null {
  if (!payload?.role || !payload.sub) {
    return null;
  }

  const role = payload.role === 'farmer' ? 'farmer' : 'admin';
  const name = payload.name?.trim() || (role === 'admin' ? 'Admin' : payload.sub);
  const email = payload.email?.trim() || (role === 'farmer' ? payload.sub : undefined);

  return {
    role,
    name,
    email,
    picture: payload.picture ?? undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        const nextUser = buildUserFromClaims(decodeJwtPayload(token));
        if (nextUser) {
          setUser(nextUser);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persist = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
  }, []);

  const loginAdmin = useCallback(async (username: string, password: string) => {
    try {
      const response = await loginAdminApi({ username, password });
      localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
      persist(buildUserFromClaims(decodeJwtPayload(response.access_token)));
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Invalid admin credentials.';
      return { success: false, message };
    }
  }, [persist]);

  const loginFarmerWithGoogleCredential = useCallback(async (credential: string) => {
    try {
      const response = await loginFarmerApi({ id_token: credential });
      localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
      persist(buildUserFromClaims(decodeJwtPayload(response.access_token)));
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Google login failed.';
      return { success: false, message };
    }
  }, [persist]);

  const loginDemoFarmer = useCallback(async (email: string) => {
    try {
      const response = await loginDemoFarmerApi(email);
      localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
      persist(buildUserFromClaims(decodeJwtPayload(response.access_token)));
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Demo farmer login failed.';
      return { success: false, message };
    }
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    persist(null);
  }, [persist]);

  const value = useMemo<AuthContextType>(
    () => ({ user, isLoading, loginAdmin, loginFarmerWithGoogleCredential, loginDemoFarmer, logout }),
    [user, isLoading, loginAdmin, loginFarmerWithGoogleCredential, loginDemoFarmer, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
