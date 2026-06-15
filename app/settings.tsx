import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/motorista/app-header';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useBiometrics } from '@/hooks/use-biometrics';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Como apareço nos resultados de busca?',
    a: 'O SUWAVE distribui corridas e entregas de acordo com sua localização, tipo de veículo e disponibilidade. Mantenha-se online para receber solicitações próximas.',
  },
  {
    q: 'Quando recebo meus ganhos?',
    a: 'Os ganhos são creditados no seu saldo disponível após a conclusão de cada corrida ou entrega. O saque está disponível via Pix no painel financeiro.',
  },
  {
    q: 'Como cadastrar ou trocar meu veículo?',
    a: 'Acesse o menu lateral > Veículo para adicionar ou atualizar seu veículo. Veículos precisam ser aprovados pela equipe SUWAVE antes de você poder ficar online.',
  },
  {
    q: 'O que fazer se tiver um problema na corrida?',
    a: 'Entre em contato com o suporte via WhatsApp ou e-mail logo abaixo. Nossa equipe atende em horário comercial de seg–sáb.',
  },
  {
    q: 'Minha biometria não funciona. O que fazer?',
    a: 'Faça login normalmente com e-mail e senha. A biometria será reativada automaticamente após o próximo login bem-sucedido. Se o problema persistir, desative e reative nas configurações.',
  },
];

export default function SettingsScreen() {
  const biometrics = useBiometrics();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  function handleDisableBiometrics() {
    Alert.alert(
      'Desativar biometria',
      'Isso removerá o acesso rápido. Você precisará digitar sua senha no próximo login.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => biometrics.clearCredentials(),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader onBack={() => router.replace('/dashboard')} />

        <Text style={styles.title}>Configurações</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Segurança</Text>
          {biometrics.state === 'ready' ? (
            <SettingsRow
              icon="lock"
              label="Desativar biometria"
              onPress={handleDisableBiometrics}
            />
          ) : (
            <View style={styles.infoRow}>
              <Feather color={SuwaveColors.muted} name="lock" size={18} />
              <Text style={styles.infoLabel}>Biometria</Text>
              <Text style={styles.infoValue}>{biometrics.state === 'unavailable' ? 'Não disponível' : 'Não configurada'}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Suporte</Text>
          <SettingsRow
            icon="message-circle"
            label="Falar com o suporte"
            onPress={() => Linking.openURL('https://wa.me/5500000000000')}
          />
          <SettingsRow
            icon="mail"
            label="Enviar e-mail"
            onPress={() => Linking.openURL('mailto:suporte@suwave.com.br')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Perguntas frequentes</Text>
          {FAQ_ITEMS.map((item, index) => (
            <Pressable
              key={index}
              onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
              style={styles.faqItem}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Feather
                  color={SuwaveColors.muted}
                  name={expandedFaq === index ? 'chevron-up' : 'chevron-down'}
                  size={16}
                />
              </View>
              {expandedFaq === index ? (
                <Text style={styles.faqA}>{item.a}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <SettingsRow
            icon="shield"
            label="Política de privacidade"
            onPress={() => Linking.openURL('https://suwave.com.br/privacidade')}
          />
          <SettingsRow
            icon="file-text"
            label="Termos de uso"
            onPress={() => Linking.openURL('https://suwave.com.br/termos')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App</Text>
          <View style={styles.infoRow}>
            <Feather color={SuwaveColors.muted} name="info" size={18} />
            <Text style={styles.infoLabel}>Versão</Text>
            <Text style={styles.infoValue}>{APP_VERSION}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Feather color={SuwaveColors.ink} name={icon} size={18} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Feather color={SuwaveColors.muted} name="chevron-right" size={16} />
    </Pressable>
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
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: SuwaveColors.ink,
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: SuwaveColors.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: SuwaveColors.ink,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 10,
  },
  infoLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: SuwaveColors.ink,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SuwaveColors.muted,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  faqQ: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: SuwaveColors.ink,
    lineHeight: 20,
  },
  faqA: {
    fontSize: 14,
    lineHeight: 20,
    color: SuwaveColors.muted,
  },
});
