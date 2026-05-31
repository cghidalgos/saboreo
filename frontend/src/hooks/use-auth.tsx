import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, getStoredToken, clearStoredToken } from "@/integrations/api/client";

export type AppRole = "admin" | "investigador" | "operador";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  institution: string | null;
}

interface MeResponse extends Profile {
  roles: AppRole[];
}

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchMe(): Promise<{ profile: Profile; roles: AppRole[]; user: AuthUser } | null> {
  try {
    const data = await apiFetch<MeResponse>("/api/auth/me");
    const { roles, ...profile } = data;
    return { profile, roles, user: { id: profile.id, email: profile.email ?? "" } };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function hydrate() {
    const token = getStoredToken();
    if (!token) {
      setSession(null);
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    const result = await fetchMe();
    if (result) {
      setSession({ access_token: token, user: result.user });
      setProfile(result.profile);
      setRoles(result.roles);
    } else {
      clearStoredToken();
      setSession(null);
      setProfile(null);
      setRoles([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    hydrate();
    const handler = () => hydrate();
    window.addEventListener("auth-change", handler);
    return () => window.removeEventListener("auth-change", handler);
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    signOut: async () => {
      clearStoredToken();
      setSession(null);
      setProfile(null);
      setRoles([]);
      window.dispatchEvent(new CustomEvent("auth-change"));
    },
    refresh: async () => {
      const result = await fetchMe();
      if (!result) return;
      const token = getStoredToken()!;
      setSession({ access_token: token, user: result.user });
      setProfile(result.profile);
      setRoles(result.roles);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  investigador: "Investigador",
  operador: "Operador",
};
