// Session state: the logged-in user and the login / logout actions.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, loadToken, onUnauthorized, saveToken } from "./api";
import type { User } from "./types";

interface Session {
  user: User | null;
  checking: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => Boolean(loadToken()));

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
    if (!loadToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password);
    saveToken(access_token);
    setUser(await api.me());
  }, []);

  const value = useMemo(() => ({ user, checking, login, logout }), [user, checking, login, logout]);
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
