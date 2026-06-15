import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { DriverWorkMode, useDriverFlowStore } from '@/stores/driver-flow-store';

const options: { description: string; image: keyof typeof SuwaveAssets; label: string; value: DriverWorkMode }[] = [
  { description: 'Viagem e entrega com carro', image: 'workmodeCar', label: 'Viagem e entrega com carro', value: 'car_trip_delivery' },
  { description: 'Entrega com carro', image: 'workmodeVan', label: 'Entrega com carro', value: 'car_delivery' },
  { description: 'Entrega com moto', image: 'workmodeMoto', label: 'Entrega com moto', value: 'moto_delivery' },
  { description: 'Entrega com bicicleta', image: 'workmodeBike', label: 'Entrega com bicicleta', value: 'bike_delivery' },
];

/**
 * Equivalente nativo da tela `vehicle-mode` (`VehicleMode`) em
 * app/motorista/src/app/page.tsx:6441-6521.
 */
export default function VehicleModeScreen() {
  const selectedWorkMode = useDriverFlowStore((state) => state.selectedWorkMode);
  const setSelectedWorkMode = useDriverFlowStore((state) => state.setSelectedWorkMode);
  const setEditingVehicleId = useDriverFlowStore((state) => state.setEditingVehicleId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.replace('/dashboard')} style={styles.backButton}>
          <Feather color="#143446" name="arrow-left" size={18} />
        </Pressable>

        <View style={styles.copy}>
          <Text style={styles.title}>Escolha sua forma de trabalho</Text>
          <Text style={styles.text}>Use seu proprio veiculo ou alugue um e comece a viajar e fazer entregas.</Text>
          <Text style={styles.strong}>Necessario: CNH com EAR</Text>
          <Text style={styles.small}>Selecione uma opcao abaixo.</Text>
        </View>

        <View style={styles.list}>
          {options.map((option) => {
            const active = selectedWorkMode === option.value;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={option.value}
                onPress={() => setSelectedWorkMode(option.value)}
                style={[styles.card, active && styles.cardActive]}>
                <View style={styles.illustration}>
                  <Image resizeMode="cover" source={SuwaveAssets[option.image]} style={styles.illustrationImage} />
                </View>
                <Text style={styles.cardLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ActionButton
          disabled={!selectedWorkMode}
          onPress={() => {
            setEditingVehicleId(undefined);
            router.push('/vehicle-data');
          }}>
          Continuar
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
    paddingHorizontal: 24,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6edf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0c2a3a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  copy: {
    gap: 8,
    marginBottom: 22,
  },
  title: {
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '900',
    color: '#0d2434',
  },
  text: {
    fontSize: 17,
    lineHeight: 23,
    color: '#5b6d79',
    maxWidth: 280,
  },
  strong: {
    fontSize: 16,
    fontWeight: '800',
    color: '#102838',
  },
  small: {
    fontSize: 15,
    color: '#687985',
  },
  list: {
    gap: 14,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 104,
    borderWidth: 1,
    borderColor: '#e8edf1',
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0c2a3a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 1,
  },
  cardActive: {
    borderColor: '#ffc61a',
    shadowOpacity: 0.16,
  },
  illustration: {
    width: 96,
    height: 84,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff6d8',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  cardLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 21,
    color: '#102838',
  },
});
