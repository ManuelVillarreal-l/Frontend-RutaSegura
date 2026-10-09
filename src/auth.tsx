// Session state: signed-in user, token expiry (30 minutes) and the catalogs from the database.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, loadToken, onUnauthorized, saveToken, tokenExpiry } from "./api";
import type { CatalogItem, CatalogName, Catalogs, User } from "./types";

interface Session {
  user: User | null;
  checking: boolean;
  expiresAt: number | null;
  catalogs: Catalogs | null;
  // Message shown on the login screen after an automatic logout.
  endedReason: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
  reloadCatalogs: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export const SESSION_EXPIRED = "Su sesión venció (dura 30 minutos). Inicie sesión de nuevo.";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(() => tokenExpiry(loadToken()));
  const [checking, setChecking] = useState(() => Boolean(loadToken()));
  const [endedReason, setEndedReason] = useState<string | null>(null);

  const logout = useCallback((reason?: string) => {
    saveToken(null);
    setUser(null);
    setCatalogs(null);
    setExpiresAt(null);
    setEndedReason(reason ?? null);
  }, []);

  const reloadCatalogs = useCallback(async () => {
    setCatalogs(await api.catalogs());
  }, []);

  // Restore a session that is still valid (same tab, page reload).
  useEffect(() => {
    onUnauthorized((message) => logout(message));
    const token = loadToken();
    if (!token) return;
    const exp = tokenExpiry(token);
    if (!exp || exp <= Date.now()) {
      logout(SESSION_EXPIRED);
      setChecking(false);
      return;
    }
    Promise.all([api.profile(), api.catalogs()])
      .then(([profile, cat]) => {
        setUser(profile);
        setCatalogs(cat);
      })
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  // Close the session automatically when the token expires.
  useEffect(() => {
    if (!expiresAt || !user) return;
    const timer = window.setTimeout(() => logout(SESSION_EXPIRED), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt, user, logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password);
    saveToken(access_token);
    setExpiresAt(tokenExpiry(access_token));
    const [profile, cat] = await Promise.all([api.profile(), api.catalogs()]);
    setEndedReason(null);
    setCatalogs(cat);
    setUser(profile);
  }, []);

  const value = useMemo(
    () => ({ user, checking, expiresAt, catalogs, endedReason, login, logout, reloadCatalogs }),
    [user, checking, expiresAt, catalogs, endedReason, login, logout, reloadCatalogs],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

// The signed-in user; only call inside pages that require login.
export function useCurrentUser(): User {
  const { user } = useSession();
  if (!user) throw new Error("No user in session");
  return user;
}

// Active items of one catalog (labels come from the database, never from the code).
export function useCatalog(name: CatalogName): CatalogItem[] {
  const { catalogs } = useSession();
  return (catalogs?.[name] ?? []).filter((item) => item.active);
}

// Spanish name of a catalog code, e.g. label("roles", "driver") -> "Conductor".
export function useCatalogLabel() {
  const { catalogs } = useSession();
  return useCallback(
    (name: CatalogName, code: string) => catalogs?.[name]?.find((item) => item.code === code)?.name ?? code,
    [catalogs],
  );
}
