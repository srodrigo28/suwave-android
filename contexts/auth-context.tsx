import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { deleteSecureItem, getSecureItem, setSecureItem } from '@/utils/secure-storage';

import { DriverApiError, DriverProfile, getDriverProfile, loginDriverAccount, onDriverAuthExpired } from '@/services/driver-client';

/**
 * Sessao do motorista (token + perfil), equivalente ao par
 * `driverToken`/`localStorage.getItem("suwave-driver-token")` em
 * app/motorista/src/app/page.tsx:223-228 e 7095-7157, adaptado para
 * `expo-secure-store` (sem `window`/`localStorage`).
 */

const TOKEN_STORAGE_KEY = 'suwave-driver-token';

type AuthContextValue = {
  token: string | null;
  driver: DriverProfile | null;
  isRestoring: boolean;
  sessionError: string;
  login: (input: { identifier: string; password: string }) => Promise<DriverProfile | null>;
  authenticate: (accessToken: string) => Promise<DriverProfile | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<DriverProfile | null>;
  clearSessionError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function isTransientNetworkError(error: unknown) {
  return (
    error instanceof Error
    && !(error instanceof DriverApiError)
    && (
      error.message.includes('A API demorou muito para responder')
      || error.message.includes('API principal indisponível')
    )
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const refreshProfile = useCallback(async (currentToken?: string) => {
    const activeToken = currentToken ?? token;
    if (!activeToken) return null;
    const profile = await getDriverProfile(activeToken);
    setDriver(profile);
    return profile;
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedToken = await getSecureItem(TOKEN_STORAGE_KEY);
      if (cancelled) return;

      if (!storedToken) {
        setIsRestoring(false);
        return;
      }

      setToken(storedToken);
      try {
        const profile = await getDriverProfile(storedToken);
        if (!cancelled) setDriver(profile);
      } catch (error) {
        if (!cancelled && error instanceof DriverApiError && error.code === 'token_expired') {
          await deleteSecureItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setDriver(null);
        } else if (!cancelled && isTransientNetworkError(error)) {
          setSessionError('Não foi possível validar sua sessão agora. Verifique a conexão e tente novamente.');
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await deleteSecureItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setDriver(null);
    setSessionError('');
  }, []);

  useEffect(() => {
    return onDriverAuthExpired(() => {
      deleteSecureItem(TOKEN_STORAGE_KEY).catch(() => {});
      setToken(null);
      setDriver(null);
      setSessionError('Sua sessão expirou. Entre novamente para continuar.');
    });
  }, []);

  const authenticate = useCallback(async (accessToken: string) => {
    await setSecureItem(TOKEN_STORAGE_KEY, accessToken);
    setSessionError('');
    setToken(accessToken);
    try {
      return await refreshProfile(accessToken);
    } catch (error) {
      if (isTransientNetworkError(error)) {
        setSessionError('Sessão iniciada, mas o perfil ainda não carregou. Verifique a conexão e continue.');
        return null;
      }
      throw error;
    }
  }, [refreshProfile]);

  const login = useCallback(async ({ identifier, password }: { identifier: string; password: string }) => {
    const isEmail = identifier.includes('@');
    const credentials = {
      ...(isEmail ? { email: identifier.trim() } : { whatsapp: onlyDigits(identifier) }),
      password,
    };

    let session;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        session = await loginDriverAccount(credentials);
        break;
      } catch (err) {
        const shouldRetry = attempt < 3 && (
          (err instanceof DriverApiError && err.code === 'internal_error')
          || isTransientNetworkError(err)
        );
        if (!shouldRetry) throw err;
        await new Promise((resolve) => setTimeout(resolve, attempt * 650));
      }
    }
    if (!session) {
      session = await loginDriverAccount(credentials);
    }

    return authenticate(session.access_token);
  }, [authenticate]);

  const refreshCurrentProfile = useCallback(() => refreshProfile(), [refreshProfile]);
  const clearSessionError = useCallback(() => setSessionError(''), []);

  return (
    <AuthContext.Provider
      value={{
        token,
        driver,
        isRestoring,
        sessionError,
        login,
        authenticate,
        logout,
        refreshProfile: refreshCurrentProfile,
        clearSessionError,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider.');
  }
  return context;
}
