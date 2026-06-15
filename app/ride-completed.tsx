import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { Confetti } from '@/components/motorista/confetti';
import { SuccessCheck } from '@/components/motorista/success-check';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

export default function RideCompletedScreen() {
  const ride = useDriverFlowStore((state) => state.activeRide);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Confetti />
      <ScrollView contentContainerStyle={styles.content}>
        <SuwaveWordmark subtitle="MOTORISTA" />

        <SuccessCheck />

        <Text style={styles.title}>Corrida concluída!</Text>
        <Text style={styles.copy}>
          {ride?.destination_label ? `Destino: ${ride.destination_label}. ` : ''}
          Obrigado por completar a corrida com segurança.
        </Text>

        <View style={styles.successBox}>
          <Feather color="#f2b100" name="zap" size={32} style={styles.successIcon} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Ganhos registrados</Text>
            <Text style={styles.successText}>O valor será creditado no seu saldo em breve.</Text>
          </View>
        </View>

        <ActionButton iconDirection="left" onPress={() => router.replace('/dashboard')}>
          Voltar ao início
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
    justifyContent: 'center',
    paddingHorizontal: SuwaveSpacing.screenHorizontal,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
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
    marginBottom: 18,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff8e4',
    borderWidth: 1,
    borderColor: '#ffe39a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  successIcon: {
    flexShrink: 0,
  },
  successCopy: {
    flex: 1,
    gap: 4,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#22384a',
    lineHeight: 20,
  },
  successText: {
    fontSize: 15,
    lineHeight: 19,
    color: '#556977',
  },
});
