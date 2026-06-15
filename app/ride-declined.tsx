import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { SuccessCheck } from '@/components/motorista/success-check';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';

/**
 * Equivalente nativo da tela `ride-declined` (`RideDeclined`) em
 * app/motorista/src/app/page.tsx:1514-1528.
 */
export default function RideDeclinedScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <SuwaveWordmark subtitle="MOTORISTA" />

        <SuccessCheck name="x" />

        <Text style={styles.title}>Corrida recusada</Text>
        <Text style={styles.copy}>A corrida foi recusada. Novas solicitações aparecerão em breve.</Text>

        <ActionButton iconDirection="left" onPress={() => router.replace('/dashboard')}>
          Voltar ao dashboard
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
    marginBottom: 24,
  },
});
