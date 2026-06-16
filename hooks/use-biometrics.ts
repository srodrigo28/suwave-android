import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { deleteSecureItem, getSecureItem, setSecureItem } from '@/utils/secure-storage';

const BIOMETRIC_ID_KEY = 'suwave-bio-identifier';
const BIOMETRIC_PW_KEY = 'suwave-bio-password';

export type BiometricState = 'unavailable' | 'no_credentials' | 'ready';

export function useBiometrics() {
  const [state, setState] = useState<BiometricState>('unavailable');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    async function check() {
      const [hasHardware, enrolled, storedId, storedPw] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        getSecureItem(BIOMETRIC_ID_KEY),
        getSecureItem(BIOMETRIC_PW_KEY),
      ]);
      if (!hasHardware || !enrolled) { setState('unavailable'); return; }
      if (!storedId || !storedPw) { setState('no_credentials'); return; }
      setState('ready');
    }
    check();
  }, []);

  const saveCredentials = useCallback(async (identifier: string, password: string) => {
    if (Platform.OS === 'web') return;
    try {
      await Promise.all([
        setSecureItem(BIOMETRIC_ID_KEY, identifier),
        setSecureItem(BIOMETRIC_PW_KEY, password),
      ]);
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      setState(hasHardware && enrolled ? 'ready' : 'no_credentials');
    } catch {
      // SecureStore unavailable — biometrics remain disabled
    }
  }, []);

  const authenticate = useCallback(async (): Promise<{ identifier: string; password: string } | null> => {
    if (Platform.OS === 'web') return null;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Entre com biometria',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (!result.success) return null;
    const [identifier, password] = await Promise.all([
      getSecureItem(BIOMETRIC_ID_KEY),
      getSecureItem(BIOMETRIC_PW_KEY),
    ]);
    if (!identifier || !password) return null;
    return { identifier, password };
  }, []);

  const clearCredentials = useCallback(async () => {
    if (Platform.OS === 'web') return;
    await Promise.all([
      deleteSecureItem(BIOMETRIC_ID_KEY),
      deleteSecureItem(BIOMETRIC_PW_KEY),
    ]);
    setState('no_credentials');
  }, []);

  return { state, saveCredentials, authenticate, clearCredentials };
}
