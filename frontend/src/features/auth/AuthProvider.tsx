import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { ApiError, clearCsrf, getCsrf, onSessionExpired } from '../../api/client';
import type { SessionUser } from '../../api/types';
interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  error: unknown;
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  dismissError: () => void;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [expired, setExpired] = useState(false);
  const clear = useCallback(() => {
    setUser(null);
    clearCsrf();
    void client.cancelQueries();
    client.clear();
  }, [client]);
  const refresh = useCallback(async () => {
    setError(null);
    try {
      setUser(await api.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clear();
      else {
        setError(e);
        throw e;
      }
    } finally {
      setLoading(false);
    }
  }, [clear]);
  useEffect(() => {
    void refresh().catch(() => {});
    return onSessionExpired(() => {
      clear();
      setExpired(true);
    });
  }, [clear, refresh]);
  const login = async (email: string, password: string) => {
    setError(null);
    await getCsrf(true);
    const nextUser = await api.login(email, password);
    clearCsrf();
    // The authenticated antiforgery token is bound to the new identity.
    try {
      await getCsrf(true);
    } finally {
      setUser(nextUser);
      setExpired(false);
      setError(null);
    }
  };
  const dismissError = useCallback(() => setError(null), []);
  const logout = async () => {
    await api.logout();
    clear();
    setExpired(false);
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, expired, login, logout, refresh, dismissError }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error('AuthProvider is missing');
  return state;
}
