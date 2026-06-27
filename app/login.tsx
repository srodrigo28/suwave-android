import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { Field } from '@/components/motorista/field';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveColors, SuwaveSpacing, SuwaveTypography, SuwaveAssets } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
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
  const passwordRef = useRef<TextInput>(null);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SuwaveWordmark subtitle="MOTORISTA" />

        <Image resizeMode="contain" source={SuwaveAssets.loginHero} style={styles.heroImage} />

        <Field
          autoCapitalize="none"
          autoCorrect={false}
          icon="mail"
          keyboardType="email-address"
          onChangeText={setIdentifier}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="E-mail ou WhatsApp"
          returnKeyType="next"
          textContentType="username"
          value={identifier}
        />
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          icon="lock"
          inputRef={passwordRef}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          placeholder="Senha"
          returnKeyType="go"
          secure
          textContentType="password"
          value={password}
        />

        <Pressable onPress={() => router.push('/forgot-password')} style={styles.linkButton}>
          <Text style={styles.linkText}>Esqueci minha senha</Text>
        </Pressable>

        <FormToast message={success || error || sessionError} tone={success ? 'success' : 'warning'} />

        <ActionButton loading={isSubmitting} onPress={handleLogin}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </ActionButton>

        <ActionButton iconDirection="none" onPress={() => router.push('/signup')} secondary>
          Cadastrar como motorista
        </ActionButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SuwaveColors.background,
  },
  flex: {
    flex: 1,
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
});
