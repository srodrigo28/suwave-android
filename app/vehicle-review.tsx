import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { AppHeader } from '@/components/motorista/app-header';
import { FormToast } from '@/components/motorista/form-toast';
import { ProgressSteps } from '@/components/motorista/progress-steps';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { saveDriverVehicle, updateDriverVehicle, uploadDriverImage } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { getWorkModeUi, vehicleSteps, workModeToVehicleType } from '@/utils/vehicles';

const reviewLabels = ['Dados do veículo', 'Documentos e informações', 'Fotos do veículo', '4 de 4'];

/**
 * Equivalente nativo da tela `vehicle-review` (`VehicleReview`) em
 * app/motorista/src/app/page.tsx:6963-7092.
 */
export default function VehicleReviewScreen() {
  const { token } = useAuth();
  const editingVehicleId = useDriverFlowStore((state) => state.editingVehicleId);
  const setEditingVehicleId = useDriverFlowStore((state) => state.setEditingVehicleId);
  const selectedBrand = useDriverFlowStore((state) => state.selectedBrand);
  const selectedWorkMode = useDriverFlowStore((state) => state.selectedWorkMode);
  const vehicleForm = useDriverFlowStore((state) => state.vehicleForm);
  const vehicleUploads = useDriverFlowStore((state) => state.vehicleUploads);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modeUi = getWorkModeUi(selectedWorkMode);

  async function handleTrackStatus() {
    const hasRequiredPlate = !modeUi.needsPlate || Boolean(vehicleForm.plate.trim());

    if (!token || !selectedBrand || !selectedBrand.nome.trim() || !vehicleForm.model.trim() || !hasRequiredPlate) {
      setError(
        modeUi.needsPlate
          ? 'Informe marca, modelo e placa antes de enviar.'
          : 'Informe marca e modelo antes de enviar.',
      );
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const [frontUp, interiorUp, rearUp, sideUp] = await Promise.all([
        vehicleUploads.front ? uploadDriverImage(token, vehicleUploads.front, 'driver_vehicle') : Promise.resolve(null),
        vehicleUploads.interior ? uploadDriverImage(token, vehicleUploads.interior, 'driver_vehicle') : Promise.resolve(null),
        vehicleUploads.rear ? uploadDriverImage(token, vehicleUploads.rear, 'driver_vehicle') : Promise.resolve(null),
        vehicleUploads.side ? uploadDriverImage(token, vehicleUploads.side, 'driver_vehicle') : Promise.resolve(null),
      ]);

      const payload = {
        brand: selectedBrand.nome,
        front_photo_file_id: frontUp?.storage_file_id,
        front_photo_url: frontUp?.url ?? null,
        interior_photo_file_id: interiorUp?.storage_file_id,
        interior_photo_url: interiorUp?.url ?? null,
        model: vehicleForm.model,
        plate: modeUi.needsPlate ? vehicleForm.plate : 'BIKE',
        rear_photo_file_id: rearUp?.storage_file_id,
        rear_photo_url: rearUp?.url ?? null,
        side_photo_file_id: sideUp?.storage_file_id,
        side_photo_url: sideUp?.url ?? null,
        vehicle_type: workModeToVehicleType(selectedWorkMode),
        year: vehicleForm.year || undefined,
      };

      if (editingVehicleId) {
        await updateDriverVehicle(token, editingVehicleId, payload);
        setEditingVehicleId(undefined);
        router.replace('/vehicle-list');
        return;
      }

      await saveDriverVehicle(token, payload);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o veículo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader onBack={() => router.replace('/vehicle-photos')} />

        <ProgressSteps current={4} labels={reviewLabels} total={vehicleSteps} />

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {editingVehicleId ? 'Alterações prontas para salvar' : 'Cadastro enviado para análise'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {editingVehicleId
              ? 'Revise as fotos atualizadas antes de salvar.'
              : 'Todos os dados foram recebidos com sucesso.'}
          </Text>

          <View style={styles.heroArt}>
            <View style={styles.badge}>
              <Feather color="#fff" name="check" size={32} />
            </View>
            <Text style={[styles.spark, styles.sparkOne]}>+</Text>
            <Text style={[styles.spark, styles.sparkTwo]}>+</Text>
            <Text style={[styles.spark, styles.sparkThree]}>+</Text>
            {vehicleUploads.front?.uri ? (
              <Image resizeMode="contain" source={{ uri: vehicleUploads.front.uri }} style={styles.heroPhoto} />
            ) : (
              <Image resizeMode="contain" source={SuwaveAssets[modeUi.emptyPreviewImageSrc]} style={styles.heroPhoto} />
            )}
          </View>
        </View>

        <View style={styles.checklist}>
          <ChecklistRow first label="Cadastro do motorista concluído" />
          <ChecklistRow label="Escolha da modalidade concluída" />
          <ChecklistRow label="CNH enviada" />
          <ChecklistRow label="Dados do veículo cadastrados" />
          <ChecklistRow label="Fotos do veículo enviadas" />
          <ChecklistRow label="Termos e Política aceitos" />
        </View>

        <View style={styles.successBox}>
          <Feather color="#f2b100" name="shield" size={32} style={styles.successIcon} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>
              {editingVehicleId ? 'As fotos do veículo serão atualizadas.' : 'Seu cadastro está em análise.'}
            </Text>
            <Text style={styles.successText}>
              {editingVehicleId
                ? 'Você pode substituir uma foto específica ou confirmar a troca de todas.'
                : 'Nossa equipe fará a avaliação e em breve entrará em contato.'}
            </Text>
          </View>
        </View>

        <FormToast message={error} />

        <ActionButton disabled={isSubmitting} loading={isSubmitting} onPress={handleTrackStatus}>
          {editingVehicleId ? 'Salvar alterações' : 'Voltar ao início'}
        </ActionButton>
        <ActionButton iconDirection="left" onPress={() => router.replace('/vehicle-photos')} secondary>
          Voltar
        </ActionButton>

        <View style={styles.benefits}>
          <Text style={styles.benefitItem}>▣ Cadastro seguro</Text>
          <Text style={styles.benefitItem}>☆ Processo rápido</Text>
          <Text style={styles.benefitItem}>▤ Mais corridas, mais ganhos</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistRow({ first = false, label }: { first?: boolean; label: string }) {
  return (
    <View style={[styles.checklistRow, first && styles.checklistRowFirst]}>
      <View style={styles.checklistIcon}>
        <Feather color="#fff" name="check" size={11} />
      </View>
      <Text style={styles.checklistLabel}>{label}</Text>
    </View>
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
  hero: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 16,
    color: SuwaveColors.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
  heroArt: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 170,
    marginTop: 4,
    width: '100%',
  },
  badge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffc108',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 4,
  },
  spark: {
    position: 'absolute',
    fontSize: 26,
    fontWeight: '800',
    color: '#ffc61a',
  },
  sparkOne: {
    left: '18%',
    top: 36,
  },
  sparkTwo: {
    right: '18%',
    top: 24,
  },
  sparkThree: {
    right: '8%',
    top: 60,
  },
  heroPhoto: {
    width: '70%',
    height: 130,
    marginTop: 30,
  },
  checklist: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8edf1',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginVertical: 18,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: SuwaveColors.line,
  },
  checklistRowFirst: {
    borderTopWidth: 0,
  },
  checklistIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffc61a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#243949',
    lineHeight: 21,
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
    marginBottom: 8,
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
  benefits: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  benefitItem: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#244b63',
    textAlign: 'center',
    lineHeight: 19,
  },
});
