import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const BIOMETRIC_ID_KEY = 'suwave-bio-identifier';
const BIOMETRIC_PW_KEY = 'suwave-bio-password';

export type BiometricState = 'unavailable' | 'no_credentials' | 'ready';

export function useBiometrics() {
  const [state, setState] = useState<BiometricState>('unavailable');

  useEffect(() => {
    async function check() {
      const [hasHardware, enrolled, storedId, storedPw] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(BIOMETRIC_ID_KEY),
        SecureStore.getItemAsync(BIOMETRIC_PW_KEY),
      ]);
      if (!hasHardware || !enrolled) { setState('unavailable'); return; }
      if (!storedId || !storedPw) { setState('no_credentials'); return; }
      setState('ready');
    }
    check();
  }, []);

  const saveCredentials = useCallback(async (identifier: string, password: string) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(BIOMETRIC_ID_KEY, identifier),
        SecureStore.setItemAsync(BIOMETRIC_PW_KEY, password),
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
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Entre com biometria',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (!result.success) return null;
    const [identifier, password] = await Promise.all([
      SecureStore.getItemAsync(BIOMETRIC_ID_KEY),
      SecureStore.getItemAsync(BIOMETRIC_PW_KEY),
    ]);
    if (!identifier || !password) return null;
    return { identifier, password };
  }, []);

  const clearCredentials = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(BIOMETRIC_ID_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_PW_KEY),
    ]);
    setState('no_credentials');
  }, []);

  return { state, saveCredentials, authenticate, clearCredentials };
}
