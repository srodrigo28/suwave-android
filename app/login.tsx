import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { Field } from '@/components/motorista/field';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { useBiometrics } from '@/hooks/use-biometrics';
import { checkDriverAccountAvailability, DriverApiError } from '@/services/driver-client';

/**
 * Equivalente nativo da tela `login` (`Login`) em
 * app/motorista/src/app/page.tsx:1033-1138.
 *
 * `handleLogin` chama `useAuth().login` (que usa `loginDriverAccount` com
 * a mesma logica de retry/disponibilidade de conta do `LoginWithRetry`/
 * `resolveInvalidCredentialsMessage` da versao web) e navega para
 * `/dashboard` apos `sessionError` inicial (sessao expirada) ser exibido
 * via `FormToast`.
 */
export default function LoginScreen() {
  const { login, sessionError, clearSessionError } = useAuth();
  const biometrics = useBiometrics();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => clearSessionError();
  }, [clearSessionError]);

  async function resolveInvalidCredentialsMessage(isEmail: boolean) {
    try {
      const availability = await checkDriverAccountAvailability(
        isEmail ? { email: identifier.trim() } : { whatsapp: identifier.replace(/\D/g, '') },
      );
      const detail = isEmail ? availability.conflicts.email : availability.conflicts.whatsapp;
      const hasAccount = detail?.exists ?? false;
      return hasAccount ? 'Senha incorreta.' : isEmail ? 'E-mail não encontrado.' : 'WhatsApp não encontrado.';
    } catch {
      return 'E-mail ou senha inválidos.';
    }
  }

  async function handleLogin() {
    clearSessionError();
    setError('');
    setSuccess('');

    if (!identifier.trim() || !password) {
      setError('Informe e-mail ou WhatsApp e senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const driver = await login({ identifier, password });
      await biometrics.saveCredentials(identifier, password);
      setSuccess(`Bem-vindo, ${driver?.full_name ?? ''}.`);
      setTimeout(() => router.replace('/dashboard'), 650);
    } catch (err) {
      if (err instanceof DriverApiError && err.code === 'invalid_credentials') {
        setError(await resolveInvalidCredentialsMessage(identifier.includes('@')));
        return;
      }
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBiometricLogin() {
    setError('');
    setSuccess('');
    const creds = await biometrics.authenticate();
    if (!creds) return;
    setIsSubmitting(true);
    try {
      const driver = await login(creds);
      setSuccess(`Bem-vindo, ${driver?.full_name ?? ''}.`);
      setTimeout(() => router.replace('/dashboard'), 650);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar com biometria.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SuwaveWordmark subtitle="MOTORISTA" />

        <Image resizeMode="contain" source={SuwaveAssets.loginHero} style={styles.heroImage} />

        <Field onChangeText={setIdentifier} placeholder="E-mail ou WhatsApp" value={identifier} />
        <Field onChangeText={setPassword} placeholder="Senha" secure value={password} />

        <Pressable onPress={() => router.push('/forgot-password')} style={styles.linkButton}>
          <Text style={styles.linkText}>Esqueci minha senha</Text>
        </Pressable>

        <FormToast message={success || error || sessionError} tone={success ? 'success' : 'warning'} />

        <ActionButton loading={isSubmitting} onPress={handleLogin}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </ActionButton>

        {biometrics.state === 'ready' ? (
          <Pressable accessibilityLabel="Entrar com biometria" disabled={isSubmitting} onPress={handleBiometricLogin} style={styles.biometricButton}>
            <View style={styles.biometricIcon}>
              <Feather color={SuwaveColors.ink} name="lock" size={22} />
            </View>
            <Text style={styles.biometricText}>Entrar com biometria</Text>
          </Pressable>
        ) : null}

        <ActionButton iconDirection="none" onPress={() => router.push('/signup')} secondary>
          Cadastrar como motorista
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SuwaveColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SuwaveSpacing.screenHorizontal,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 638 / 425,
    marginBottom: 16,
  },
  linkButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 4,
  },
  linkText: {
    color: SuwaveColors.link,
    fontSize: SuwaveTypography.linkFontSize,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: SuwaveColors.line,
    backgroundColor: '#fff',
  },
  biometricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SuwaveColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricText: {
    fontSize: 15,
    fontWeight: '800',
    color: SuwaveColors.ink,
  },
});
