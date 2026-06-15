import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { DriverTerms, getDriverTerms } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

const fallbackDriverTerms: DriverTerms = {
  body:
    'A SUWAVE Motorista conecta motoristas e passageiros em cidades pequenas e regiões próximas. ' +
    'Devido às diferentes legislações municipais, necessidades operacionais e regras locais, este ' +
    'Termo de Uso poderá ser complementado por um termo específico da cidade de atuação do motorista, quando necessário.',
  document_key: 'driver_terms',
  id: null,
  privacy_url: '/more',
  title: 'Termos de uso',
  updated_at: null,
  version: 1,
};

/**
 * Equivalente nativo da tela `terms` (`TermsScreen`) em
 * app/motorista/src/app/page.tsx:2088-2176.
 */
export default function TermsScreen() {
  const signupForm = useDriverFlowStore((state) => state.signupForm);
  const setSignupForm = useDriverFlowStore((state) => state.setSignupForm);
  const [error, setError] = useState('');
  const [terms, setTerms] = useState<DriverTerms>(fallbackDriverTerms);

  useEffect(() => {
    let active = true;

    getDriverTerms()
      .then((document) => {
        if (active) setTerms(document);
      })
      .catch(() => {
        if (active) setTerms(fallbackDriverTerms);
      });

    return () => {
      active = false;
    };
  }, []);

  function toggle(field: 'accepted_terms' | 'accepted_privacy') {
    setSignupForm({ ...signupForm, [field]: !signupForm[field] });
  }

  function handleContinue() {
    setError('');

    if (!signupForm.accepted_terms || !signupForm.accepted_privacy) {
      setError('Marque os dois aceites para continuar.');
      return;
    }

    router.push('/face');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
            <Feather color="#080d2b" name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>{terms.title}</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardText}>{terms.body}</Text>
        </View>

        <Text style={styles.privacy}>
          É importante também que você leia a nossa{' '}
          <Text style={styles.privacyLink}>Política de Privacidade</Text>.
        </Text>

        <Pressable onPress={() => toggle('accepted_terms')} style={styles.row}>
          <View style={[styles.checkbox, signupForm.accepted_terms && styles.checkboxChecked]}>
            {signupForm.accepted_terms ? <Feather color="#fff" name="check" size={16} /> : null}
          </View>
          <Text style={styles.rowText}>
            Eu li, <Text style={styles.rowTextStrong}>entendi e concordo</Text> com os Termos de Uso e Política de Privacidade.
          </Text>
        </Pressable>

        <Pressable onPress={() => toggle('accepted_privacy')} style={styles.row}>
          <View style={[styles.checkbox, signupForm.accepted_privacy && styles.checkboxChecked]}>
            {signupForm.accepted_privacy ? <Feather color="#fff" name="check" size={16} /> : null}
          </View>
          <Text style={styles.rowText}>Concordo com o tratamento dos dados pessoais disponibilizados, nos termos da LGPD.</Text>
        </Pressable>

        <FormToast message={error} />

        <ActionButton onPress={handleContinue}>Continuar</ActionButton>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#080d2b',
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e0e2ea',
    borderRadius: 10,
    padding: 18,
    maxHeight: 280,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#080d2b',
  },
  privacy: {
    fontSize: 14,
    lineHeight: 22,
    color: '#080d2b',
    marginVertical: 18,
  },
  privacyLink: {
    color: '#1b49ff',
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2f72ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#2f72ff',
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#080d2b',
  },
  rowTextStrong: {
    fontWeight: '900',
  },
});
