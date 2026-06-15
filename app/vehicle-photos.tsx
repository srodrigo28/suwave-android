import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { AppHeader } from '@/components/motorista/app-header';
import { FormToast } from '@/components/motorista/form-toast';
import { ProgressSteps } from '@/components/motorista/progress-steps';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { VehiclePhotoSlotKey, getWorkModeUi, vehicleSteps } from '@/utils/vehicles';

/**
 * Equivalente nativo da tela `vehicle-photos` (`VehiclePhotos`) em
 * app/motorista/src/app/page.tsx:6800-6961.
 *
 * TODO: ligar `uploadDriverImage` (driver-client) - hoje as fotos ficam
 * apenas no estado local (`vehicleUploads`), sem upload real.
 */
export default function VehiclePhotosScreen() {
  const editingVehicleId = useDriverFlowStore((state) => state.editingVehicleId);
  const selectedWorkMode = useDriverFlowStore((state) => state.selectedWorkMode);
  const vehicleUploads = useDriverFlowStore((state) => state.vehicleUploads);
  const setVehicleUploads = useDriverFlowStore((state) => state.setVehicleUploads);

  const [error, setError] = useState('');
  const modeUi = getWorkModeUi(selectedWorkMode);

  async function pickImage(key: VehiclePhotoSlotKey) {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permita o acesso às fotos para enviar a imagem do veículo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.92,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setVehicleUploads({
      ...vehicleUploads,
      [key]: { uri: asset.uri, name: `vehicle-${key}-${Date.now()}.jpg`, type: 'image/jpeg', size: asset.fileSize ?? 0 },
    });
  }

  function handleReplaceAllPhotos() {
    setVehicleUploads({});
    setError('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader onBack={() => router.replace(editingVehicleId ? '/vehicle-list' : '/vehicle-data')} />

        <ProgressSteps current={3} total={vehicleSteps} />
        <Text style={styles.stepLabel}>3 de 4</Text>

        <Text style={styles.title}>{editingVehicleId ? `Editar fotos da ${modeUi.entityLabel}` : modeUi.photoTitle}</Text>
        <Text style={styles.subtitle}>
          {editingVehicleId
            ? 'Toque em uma foto para trocar só ela ou substitua todas de uma vez.'
            : modeUi.photoSubtitle}
        </Text>
        <Text style={styles.infoLine}>{modeUi.photoInfo}</Text>

        {editingVehicleId ? (
          <View style={styles.toolbar}>
            <Pressable onPress={handleReplaceAllPhotos} style={styles.toolbarButton}>
              <Text style={styles.toolbarButtonText}>Trocar todas as fotos</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.grid}>
          {modeUi.slots.map((slot) => {
            const image = vehicleUploads[slot.key];
            const hasPhoto = Boolean(image);

            return (
              <View key={slot.key} style={styles.photoCard}>
                <View style={styles.photoHeader}>
                  <Text style={styles.photoLabel}>{slot.label}</Text>
                  {hasPhoto ? (
                    <View style={styles.photoBadge}>
                      <Feather color="#fff" name="check" size={10} />
                    </View>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => pickImage(slot.key)}
                  style={hasPhoto ? styles.photoFilled : styles.photoEmpty}>
                  {hasPhoto && image ? (
                    <Image resizeMode="cover" source={{ uri: image.uri }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoEmptyContent}>
                      <View style={styles.photoEmptyIcon}>
                        <Feather color="#f2b400" name="camera" size={22} />
                      </View>
                      <Text style={styles.photoEmptyText}>Adicionar foto</Text>
                    </View>
                  )}
                </Pressable>
                {hasPhoto ? (
                  <View style={styles.photoStatus}>
                    <Feather color="#25a64a" name="check" size={14} />
                    <Text style={styles.photoStatusText}>Foto enviada</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <FormToast message={error} />

        <ActionButton onPress={() => router.push('/vehicle-review')}>
          {editingVehicleId ? 'Revisar alterações' : 'Enviar fotos'}
        </ActionButton>
        <ActionButton
          iconDirection="left"
          onPress={() => router.replace(editingVehicleId ? '/vehicle-list' : '/vehicle-data')}
          secondary>
          Voltar
        </ActionButton>

        <Text style={styles.security}>▣ Seus dados estão protegidos e usados apenas para verificação.</Text>
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
  stepLabel: {
    fontSize: 26,
    fontWeight: '500',
    color: SuwaveColors.muted,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: SuwaveColors.ink,
    lineHeight: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 22,
    color: SuwaveColors.muted,
    marginBottom: 8,
  },
  infoLine: {
    backgroundColor: '#fff9ea',
    borderWidth: 1,
    borderColor: '#fff0c5',
    borderRadius: 12,
    color: '#7a6413',
    fontSize: 15,
    lineHeight: 19,
    padding: 14,
    marginBottom: 8,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  toolbarButton: {
    backgroundColor: '#fff7de',
    borderWidth: 1,
    borderColor: '#ffd76f',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8a6500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginVertical: 12,
  },
  photoCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#edf1f5',
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: '#0c2a3a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 1,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoLabel: {
    fontSize: 18,
    lineHeight: 20,
    color: SuwaveColors.ink,
  },
  photoBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffc21a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFilled: {
    height: 132,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  photoEmpty: {
    height: 132,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f4d78b',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffdf7',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoEmptyContent: {
    alignItems: 'center',
    gap: 10,
  },
  photoEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#fff4cf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    fontSize: 15,
    color: SuwaveColors.ink,
  },
  photoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8a94',
  },
  security: {
    fontSize: 17,
    lineHeight: 23,
    color: '#395873',
    textAlign: 'center',
    marginTop: 20,
  },
});
