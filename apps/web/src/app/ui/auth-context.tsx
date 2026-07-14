'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { getDefaultAppPath, roleLabels } from '@/lib/authz';
import type { AuthUser } from '@/lib/types';

type LoginInput = {
  username: string;
  password: string;
};

type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  login: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<AuthUser>;
  logoutAll: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await apiClient.me();
      setUser(response.user);
      return response.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        return null;
      }

      throw error;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    refresh()
      .catch(() => {
        if (mounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [refresh]);

  const login = useCallback(
    async (input: LoginInput) => {
      await apiClient.login(input);
      const currentUser = await refresh();

      if (!currentUser) {
        throw new ApiError('Не вдалося отримати поточного користувача.', 401);
      }

      return currentUser;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } finally {
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const changePassword = useCallback(
    async (input: ChangePasswordInput) => {
      await apiClient.changePassword(input);
      const currentUser = await refresh();

      if (!currentUser) {
        throw new ApiError('Сесію не знайдено після зміни пароля.', 401);
      }

      return currentUser;
    },
    [refresh],
  );

  const logoutAll = useCallback(async () => {
    try {
      await apiClient.logoutAll();
    } finally {
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      login,
      logout,
      changePassword,
      logoutAll,
    }),
    [changePassword, loading, login, logout, logoutAll, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

export { getDefaultAppPath, roleLabels };
