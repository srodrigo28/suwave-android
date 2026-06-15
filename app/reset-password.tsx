import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { Field } from '@/components/motorista/field';
import { FormToast } from '@/components/motorista/form-toast';
import { PasswordStrengthBar } from '@/components/motorista/password-strength-bar';
import { SuccessCheck } from '@/components/motorista/success-check';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { resetDriverPassword } from '@/services/driver-client';

/**
 * Equivalente nativo da tela `reset-password` (`ResetPassword`) em
 * app/motorista/src/app/page.tsx:1288-1353.
 *
 * O token chega via deep link: suwave://reset-password?token=xxx
 */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setMessage('');

    if (password.length < 6) {
      setMessage('Use uma senha com pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirm) {
      setMessage('As senhas não coincidem.');
      return;
    }

    if (!token) {
      setMessage('Link inválido. Solicite um novo link de redefinição.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetDriverPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível redefinir sua senha.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SuwaveWordmark subtitle="MOTORISTA" />

          <SuccessCheck />

          <Text style={styles.title}>Senha redefinida</Text>
          <Text style={styles.copy}>
            Sua senha foi alterada com sucesso. Agora você pode entrar com a nova senha.
          </Text>

          <ActionButton iconDirection="left" onPress={() => router.replace('/login')}>
            Entrar agora
          </ActionButton>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SuwaveWordmark subtitle="MOTORISTA" />

        <Image resizeMode="contain" source={SuwaveAssets.loginHero} style={styles.heroImage} />

        <Text style={styles.copy}>Crie uma nova senha para sua conta</Text>

        <Field onChangeText={setPassword} placeholder="Nova senha" secure value={password} />
        <PasswordStrengthBar password={password} />
        <Field onChangeText={setConfirm} placeholder="Confirmar senha" secure value={confirm} />

        <FormToast message={message} />

        <ActionButton loading={isSubmitting} onPress={handleSubmit}>
          {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
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
