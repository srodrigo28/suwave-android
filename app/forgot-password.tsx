import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { Field } from '@/components/motorista/field';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { requestDriverPasswordReset } from '@/services/driver-client';
import { maskPhone, onlyDigits } from '@/utils/masks';

/**
 * Equivalente nativo da tela `forgot-password` (`ForgotPassword`) em
 * app/motorista/src/app/page.tsx:1140-1220.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasEmail = email.trim().length > 0;
  const hasWhatsapp = onlyDigits(whatsapp).length > 0;

  async function handleSubmit() {
    setMessage('');
    const cleanEmail = email.trim();
    const cleanWhatsapp = onlyDigits(whatsapp);

    if (!cleanEmail && !cleanWhatsapp) {
      setMessage('Informe seu e-mail ou WhatsApp para redefinir sua senha.');
      return;
    }

    if (cleanEmail && cleanWhatsapp) {
      setMessage('Escolha apenas e-mail ou WhatsApp para continuar.');
      return;
    }

    setIsSubmitting(true);
    try {
      const contact = cleanEmail ? { email: cleanEmail } : { whatsapp: cleanWhatsapp };
      await requestDriverPasswordReset(contact);
      router.push({
        pathname: '/forgot-success',
        params: cleanEmail ? { email: cleanEmail } : { whatsapp: cleanWhatsapp },
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'E-mail ou WhatsApp não encontrado.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SuwaveWordmark subtitle="MOTORISTA" />

        <Image resizeMode="contain" source={SuwaveAssets.loginHero} style={styles.heroImage} />

        <Text style={styles.copy}>Informe seu e-mail ou WhatsApp para redefinir sua senha</Text>

        <Field
          editable={!hasWhatsapp}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="E-mail"
          value={email}
        />
        <Field
          editable={!hasEmail}
          keyboardType="phone-pad"
          onChangeText={(value) => setWhatsapp(maskPhone(value))}
          placeholder="WhatsApp"
          value={whatsapp}
        />

        <FormToast message={message} />

        <ActionButton loading={isSubmitting} onPress={handleSubmit}>
          {isSubmitting ? 'Enviando...' : 'Redefinir senha'}
        </ActionButton>

        <ActionButton iconDirection="left" onPress={() => router.back()} secondary>
          Voltar
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
  copy: {
    fontSize: SuwaveTypography.heroTextFontSize,
    fontWeight: '600',
    color: SuwaveColors.ink,
    marginBottom: 4,
  },
});
