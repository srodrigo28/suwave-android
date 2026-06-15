import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { BrandLockup } from '@/components/motorista/brand-lockup';
import { FormToast } from '@/components/motorista/form-toast';
import { LabeledField } from '@/components/motorista/labeled-field';
import { ProgressSteps } from '@/components/motorista/progress-steps';
import { RadioGroupField } from '@/components/motorista/radio-group-field';
import { PasswordStrengthBar } from '@/components/motorista/password-strength-bar';
import { SelectField } from '@/components/motorista/select-field';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { checkDriverAccountAvailability, DriverApiError } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { Feather } from '@expo/vector-icons';
import { maskCnpj, maskCpf, maskDate, maskPhone, maskedDateToIso, onlyDigits } from '@/utils/masks';

const primarySteps = ['1', '2', '3', '4', '5'];

function driverAvailabilityMessage(conflicts: {
  cpf?: { exists: boolean; same_account: boolean };
  whatsapp?: { exists: boolean; same_account: boolean };
}) {
  const blockedFields = [
    conflicts.cpf?.exists && !conflicts.cpf.same_account ? 'CPF' : '',
    conflicts.whatsapp?.exists && !conflicts.whatsapp.same_account ? 'WhatsApp' : '',
  ].filter(Boolean);

  if (blockedFields.length > 0) {
    return `${blockedFields.join(' e ')} já cadastrado em outra conta SUWAVE. Entre com a conta correta ou fale com o suporte para atualizar seus dados.`;
  }

  return '';
}

/**
 * Equivalente nativo da tela `signup` (`Signup`, etapas 1 e 2) em
 * app/motorista/src/app/page.tsx:1799-2075.
 */
export default function SignupScreen() {
  const signupForm = useDriverFlowStore((state) => state.signupForm);
  const setSignupForm = useDriverFlowStore((state) => state.setSignupForm);
  const signupStep = useDriverFlowStore((state) => state.signupStep);
  const setSignupStep = useDriverFlowStore((state) => state.setSignupStep);
  const setIsLinkingExistingAccount = useDriverFlowStore((state) => state.setIsLinkingExistingAccount);

  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showLoginHint, setShowLoginHint] = useState(false);
  const [linkingBanner, setLinkingBanner] = useState(false);

  function updateField(field: keyof typeof signupForm, value: string | boolean) {
    if (showLoginHint) setShowLoginHint(false);
    setSignupForm({ ...signupForm, [field]: value });
  }

  function validateAccountStep() {
    setError('');
    if (!signupForm.full_name.trim()) {
      setError('Informe seu nome completo.');
      return false;
    }
    if (!signupForm.birth_date.trim()) {
      setError('Informe sua data de nascimento.');
      return false;
    }
    if (!signupForm.email.trim()) {
      setError('Informe seu e-mail.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email.trim())) {
      setError('Informe um e-mail válido.');
      return false;
    }
    if (!signupForm.password.trim()) {
      setError('Informe uma senha.');
      return false;
    }
    if (signupForm.password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return false;
    }
    if (signupForm.password !== signupForm.confirm_password) {
      setError('As senhas precisam ser iguais.');
      return false;
    }
    if (!maskedDateToIso(signupForm.birth_date)) {
      setError('Informe a data no formato DD/MM/AAAA.');
      return false;
    }
    if (!signupForm.gender) {
      setError('Selecione seu sexo.');
      return false;
    }

    return true;
  }

  async function handleNextSignupStep() {
    if (!validateAccountStep()) {
      return;
    }

    setError('');
    setLinkingBanner(false);
    setShowLoginHint(false);
    setIsChecking(true);
    try {
      const email = signupForm.email.trim().toLowerCase();
      const availability = await checkDriverAccountAvailability({ email });
      const emailConflict = availability.conflicts.email;

      if (emailConflict?.exists) {
        if (emailConflict.has_driver_profile) {
          // Já é motorista — bloquear
          setError('Este e-mail já possui cadastro de motorista. Faça login para continuar.');
          setShowLoginHint(true);
          return;
        }
        // É comprador, ainda não é motorista — vincular com nova senha de motorista
        setIsLinkingExistingAccount(true);
        setLinkingBanner(true);
        setSignupStep(2);
        return;
      }

      setIsLinkingExistingAccount(false);
      setSignupStep(2);
    } catch (err) {
      if (err instanceof DriverApiError && err.code === 'internal_error') {
        setSignupStep(2);
        return;
      }
      setSignupStep(2);
    } finally {
      setIsChecking(false);
    }
  }

  async function handleContinue() {
    setError('');
    const cpf = onlyDigits(signupForm.cpf);
    const cnpj = onlyDigits(signupForm.cnpj);
    const whatsapp = onlyDigits(signupForm.whatsapp);

    if (cpf.length !== 11) {
      setError('Informe um CPF com 11 números.');
      return;
    }
    if (cnpj && cnpj.length !== 14) {
      setError('Informe um CNPJ com 14 números.');
      return;
    }
    if (whatsapp.length < 10) {
      setError('Informe um WhatsApp com DDD.');
      return;
    }
    if (!signupForm.pix_key_type) {
      setError('Selecione o tipo da chave Pix.');
      return;
    }
    if (!signupForm.pix_account.trim()) {
      setError('Informe a conta Pix.');
      return;
    }

    setIsChecking(true);
    try {
      const email = signupForm.email.trim().toLowerCase();
      const availability = await checkDriverAccountAvailability({ cpf, email, whatsapp });
      const message = driverAvailabilityMessage(availability.conflicts);

      const cpfBlocked = availability.conflicts.cpf?.exists && !availability.conflicts.cpf.same_account;
      const waBlocked = availability.conflicts.whatsapp?.exists && !availability.conflicts.whatsapp.same_account;
      if (cpfBlocked || waBlocked) {
        throw new Error(message);
      }

      setError(message);
      if (!message) {
        router.push('/terms');
      }
    } catch (err) {
      if (err instanceof DriverApiError && err.code === 'internal_error') {
        setError('');
        router.push('/terms');
        return;
      }

      const message = err instanceof Error ? err.message : 'Não foi possível validar os dados agora.';
      setError(message);
      if (message.includes('outra conta SUWAVE')) {
        setShowLoginHint(true);
      }
    } finally {
      setIsChecking(false);
    }
  }

  function handleBack() {
    if (isChecking) {
      return;
    }

    if (signupStep === 1) {
      router.back();
    } else {
      setSignupStep(1);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandLockup compact />
        <ProgressSteps current={signupStep} total={primarySteps} />
        <Text style={styles.title}>Cadastro do motorista</Text>
        <Text style={styles.subtitle}>{signupStep === 1 ? 'Preencha seus dados' : 'Dados de contato e Pix'}</Text>

        {signupStep === 1 ? (
          <>
            <LabeledField
              icon="user"
              onChangeText={(value) => updateField('full_name', value)}
              placeholder="Nome completo"
              value={signupForm.full_name}
            />
            <LabeledField
              icon="calendar"
              keyboardType="numeric"
              maxLength={10}
              onChangeText={(value) => updateField('birth_date', maskDate(value))}
              placeholder="Data de nascimento"
              value={signupForm.birth_date}
            />
            <RadioGroupField
              label="Sexo"
              onChange={(value) => updateField('gender', value)}
              options={[
                { label: 'Masculino', value: 'masculino' },
                { label: 'Feminino', value: 'feminino' },
                { label: 'Outros', value: 'outros' },
              ]}
              value={signupForm.gender}
            />
            <LabeledField
              icon="mail"
              keyboardType="email-address"
              onChangeText={(value) => updateField('email', value)}
              placeholder="E-mail"
              value={signupForm.email}
            />
            <LabeledField
              icon="lock"
              onChangeText={(value) => updateField('password', value)}
              placeholder="Senha"
              secure
              value={signupForm.password}
            />
            <PasswordStrengthBar password={signupForm.password} />
            <LabeledField
              icon="lock"
              onChangeText={(value) => updateField('confirm_password', value)}
              placeholder="Confirmar senha"
              secure
              value={signupForm.confirm_password}
            />
          </>
        ) : (
          <>
            <LabeledField
              icon="phone"
              keyboardType="phone-pad"
              maxLength={15}
              onChangeText={(value) => updateField('whatsapp', maskPhone(value))}
              placeholder="WhatsApp"
              value={signupForm.whatsapp}
            />
            <LabeledField
              icon="briefcase"
              keyboardType="numeric"
              maxLength={18}
              onChangeText={(value) => updateField('cnpj', maskCnpj(value))}
              placeholder="CNPJ (opcional)"
              value={signupForm.cnpj}
            />
            <LabeledField
              icon="credit-card"
              keyboardType="numeric"
              maxLength={14}
              onChangeText={(value) => updateField('cpf', maskCpf(value))}
              placeholder="CPF"
              value={signupForm.cpf}
            />
            <SelectField
              icon="zap"
              label="Selecione tipo Pix"
              onChange={(value) => updateField('pix_key_type', value)}
              options={[
                { label: 'E-mail', value: 'email', icon: 'mail' },
                { label: 'Telefone', value: 'phone', icon: 'phone' },
                { label: 'CPF', value: 'cpf', icon: 'credit-card' },
                { label: 'CNPJ', value: 'cnpj', icon: 'briefcase' },
                { label: 'Chave aleatória', value: 'random', icon: 'zap' },
              ]}
              value={signupForm.pix_key_type}
            />
            <LabeledField
              icon="zap"
              onChangeText={(value) => updateField('pix_account', value)}
              placeholder="Conta Pix"
              value={signupForm.pix_account}
            />
          </>
        )}

        {linkingBanner ? (
          <View style={styles.linkingBanner}>
            <Feather color="#b37800" name="info" size={15} />
            <Text style={styles.linkingBannerText}>
              Este e-mail já tem conta SUWAVE. Você está criando uma senha exclusiva para o app Motorista — sua conta de comprador não será alterada.
            </Text>
          </View>
        ) : null}

        <FormToast message={error} />

        {showLoginHint ? (
          <ActionButton onPress={() => router.push('/login')}>Entrar com conta existente</ActionButton>
        ) : signupStep === 1 ? (
          <ActionButton loading={isChecking} onPress={handleNextSignupStep}>
            {isChecking ? 'Validando...' : 'Continuar'}
          </ActionButton>
        ) : (
          <ActionButton loading={isChecking} onPress={handleContinue}>
            {isChecking ? 'Validando...' : 'Continuar'}
          </ActionButton>
        )}

        <Pressable disabled={isChecking} onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
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
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0d0d0d',
    textAlign: 'center',
    marginBottom: -8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6f7480',
    textAlign: 'center',
    marginBottom: 4,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: SuwaveColors.black,
  },
  linkingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbe6',
    borderWidth: 1,
    borderColor: '#ffe58f',
    borderRadius: 10,
    padding: 12,
  },
  linkingBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#7c5800',
    lineHeight: 18,
  },
});
