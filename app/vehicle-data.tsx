import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { getWorkModeUi, normalizeBrandName } from '@/utils/vehicles';

/**
 * Equivalente nativo da tela `vehicle-data` (`VehicleData`) em
 * app/motorista/src/app/page.tsx:6611-6798.
 *
 * Simplificacoes desta primeira versao:
 * - Quando `modeUi.brandMode === 'select'` o seletor de fabricante e
 *   somente leitura e abre a tela `vehicle-brand` para trocar a marca
 *   (em vez de repetir o dropdown com busca/FIPE nesta tela). TODO:
 *   trocar para o dropdown inline se necessario.
 */
export default function VehicleDataScreen() {
  const selectedBrand = useDriverFlowStore((state) => state.selectedBrand);
  const setSelectedBrand = useDriverFlowStore((state) => state.setSelectedBrand);
  const selectedWorkMode = useDriverFlowStore((state) => state.selectedWorkMode);
  const form = useDriverFlowStore((state) => state.vehicleForm);
  const updateVehicleForm = useDriverFlowStore((state) => state.updateVehicleForm);

  const modeUi = getWorkModeUi(selectedWorkMode);
  const isFormValid =
    Boolean(selectedBrand) &&
    form.model.trim().length > 0 &&
    (!modeUi.needsYear || form.year.trim().length === 4) &&
    (!modeUi.needsPlate || form.plate.trim().length >= 7);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityLabel="Voltar" onPress={() => router.replace('/vehicle-mode')} style={styles.topbarButton}>
            <Feather color={SuwaveColors.ink} name="arrow-left" size={22} />
          </Pressable>
        </View>

        <Text style={styles.title}>{modeUi.dataTitle}</Text>
        <Text style={styles.subtitle}>{modeUi.dataSubtitle}</Text>

        <View style={styles.hero}>
          <Image resizeMode="contain" source={SuwaveAssets[modeUi.heroImageSrc]} style={styles.heroImage} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>{modeUi.brandLabel}</Text>
          {modeUi.brandMode === 'input' ? (
            <TextInput
              onChangeText={(value) => setSelectedBrand({ codigo: normalizeBrandName(value || 'bike'), nome: value })}
              placeholder="Ex: Caloi"
              placeholderTextColor="#1b3950"
              style={styles.input}
              value={selectedBrand?.nome ?? ''}
            />
          ) : (
            <Pressable onPress={() => router.push('/vehicle-brand')} style={styles.selectTrigger}>
              <Text style={styles.selectTriggerText}>{selectedBrand?.nome ?? 'Selecione o fabricante'}</Text>
              <Feather color="#1b3950" name="chevron-right" size={18} />
            </Pressable>
          )}

          <Text style={styles.label}>Modelo</Text>
          <TextInput
            onChangeText={(value) => updateVehicleForm({ model: value })}
            placeholder={modeUi.entityLabel === 'bicicleta' ? 'Ex: Aro 29 / MTB' : 'Onix'}
            placeholderTextColor="#1b3950"
            style={styles.input}
            value={form.model}
          />

          {modeUi.needsYear ? (
            <>
              <Text style={styles.label}>Ano</Text>
              <TextInput
                inputMode="numeric"
                maxLength={4}
                onChangeText={(value) => updateVehicleForm({ year: value.replace(/\D/g, '').slice(0, 4) })}
                placeholder="2022"
                placeholderTextColor="#1b3950"
                style={styles.input}
                value={form.year}
              />
            </>
          ) : null}

          {modeUi.needsPlate ? (
            <>
              <Text style={styles.label}>Placa</Text>
              <TextInput
                autoCapitalize="characters"
                maxLength={7}
                onChangeText={(value) => updateVehicleForm({ plate: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) })}
                placeholder="ABC1D23"
                placeholderTextColor="#1b3950"
                style={styles.input}
                value={form.plate}
              />
              <Text style={styles.note}>ⓘ Use letras maiúsculas.</Text>
            </>
          ) : null}
        </View>

        <ActionButton disabled={!isFormValid} onPress={() => router.push('/vehicle-photos')}>
          Continuar
        </ActionButton>

        <View style={styles.security}>
          <Text style={styles.securityIcon}>🛡</Text>
          <Text style={styles.securityText}>Suas informações estão protegidas e nunca serão compartilhadas.</Text>
        </View>
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
  topbar: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  topbarButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: SuwaveColors.ink,
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#667987',
    maxWidth: 310,
    marginBottom: 16,
  },
  hero: {
    height: 120,
    borderRadius: 16,
    backgroundColor: '#f6fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroImage: {
    width: '70%',
    height: '70%',
  },
  panel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eef2f5',
    borderRadius: 20,
    gap: 12,
    padding: 16,
    paddingTop: 18,
    marginBottom: 18,
    shadowColor: '#0c2a3a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#314454',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#f1c54a',
    borderRadius: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#19364c',
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: '#f1c54a',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  selectTriggerText: {
    fontSize: 16,
    color: '#1b3950',
  },
  note: {
    fontSize: 12,
    color: '#7b8791',
    marginTop: -6,
  },
  security: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  securityIcon: {
    fontSize: 17,
    color: '#f0b400',
  },
  securityText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: '#667987',
    textAlign: 'center',
  },
});
