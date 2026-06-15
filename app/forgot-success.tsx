import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SuccessCheck } from '@/components/motorista/success-check';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { requestDriverPasswordReset } from '@/services/driver-client';

/**
 * Equivalente nativo da tela `forgot-success` (`ForgotPasswordSuccess`) em
 * app/motorista/src/app/page.tsx:1222-1286.
 */
export default function ForgotSuccessScreen() {
  const { email, whatsapp } = useLocalSearchParams<{ email?: string; whatsapp?: string }>();
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);

  async function handleResend() {
    if (!email && !whatsapp) {
      router.replace('/forgot-password');
      return;
    }

    setMessage('');
    setIsResending(true);
    try {
      const contact = email ? { email } : { whatsapp: whatsapp! };
      await requestDriverPasswordReset(contact);
      setMessage('Link reenviado com sucesso.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível reenviar o link.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SuwaveWordmark subtitle="MOTORISTA" />

        <Image resizeMode="contain" source={SuwaveAssets.loginHero} style={styles.heroImage} />

        <SuccessCheck />

        <Text style={styles.title}>Enviado com sucesso</Text>
        <Text style={styles.copy}>
          Enviamos um link para redefinir sua senha.{'\n'}
          Você tem 24 horas para usar o link enviado.{'\n'}
          Verifique seu e-mail ou WhatsApp.
        </Text>

        <FormToast message={message} tone="success" />

        <ActionButton iconDirection="left" onPress={() => router.replace('/login')}>
          Voltar para entrar
        </ActionButton>

        <ActionButton disabled={isResending} onPress={handleResend} secondary>
          {isResending ? 'Reenviando...' : 'Reenviar link'}
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
  title: {
    fontSize: SuwaveTypography.heroTitleFontSize,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  copy: {
    fontSize: SuwaveTypography.heroTextFontSize,
    fontWeight: '600',
    color: SuwaveColors.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
});
