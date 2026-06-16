import { Feather } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { AppHeader } from '@/components/motorista/app-header';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { completeDriverDelivery, uploadDriverImage } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

/**
 * Equivalente nativo da tela `delivery-active` (`DeliveryActive`) em
 * app/motorista/src/app/page.tsx:1714-1768.
 *
 * G5 (16/06/2026): exige foto de comprovante antes de concluir.
 */
export default function DeliveryActiveScreen() {
  const { token } = useAuth();
  const delivery = useDriverFlowStore((state) => state.activeDelivery);
  const setActiveDelivery = useDriverFlowStore((state) => state.setActiveDelivery);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofFileId, setProofFileId] = useState<string | null>(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(setDriverLocation)
        .catch(() => {});
    });
  }, []);

  async function handleTakeProofPhoto() {
    setMessage('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Câmera', 'Permita o acesso à câmera para fotografar o comprovante.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    if (!token) return;
    setIsBusy(true);
    try {
      const uploaded = await uploadDriverImage(token, {
        uri: compressed.uri,
        name: `comprovante-entrega-${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: 0,
      }, 'delivery_proof');
      setProofUri(compressed.uri);
      setProofFileId(String(uploaded.storage_file_id ?? ''));
    } catch {
      setMessage('Erro ao enviar a foto. Tente novamente.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleComplete() {
    if (!proofUri) {
      setMessage('Tire uma foto do comprovante de entrega antes de concluir.');
      return;
    }
    if (!token || !delivery) {
      router.push('/delivery-completed');
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      await completeDriverDelivery(token, delivery.id);
      setActiveDelivery(null);
      router.push('/delivery-completed');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível concluir a entrega.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader onBack={() => router.replace('/dashboard')} />

        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={
            driverLocation
              ? { latitude: driverLocation.coords.latitude, longitude: driverLocation.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : { latitude: -15.7942, longitude: -47.8822, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          }
        >
          {driverLocation ? (
            <Marker coordinate={{ latitude: driverLocation.coords.latitude, longitude: driverLocation.coords.longitude }} title="Você" />
          ) : null}
        </MapView>

        <View style={styles.successBox}>
          <Feather color="#f2b100" name="truck" size={32} style={styles.successIcon} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>A caminho do cliente</Text>
            <Text style={styles.successText}>{delivery?.seller ?? 'Loja SUWAVE'} → Cliente</Text>
          </View>
        </View>

        <View style={styles.checklist}>
          <View style={styles.checklistRow}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="navigation" size={11} />
            </View>
            <Text style={styles.checklistLabel}>{delivery?.address ?? 'Endereço do cliente'}</Text>
          </View>
          <View style={[styles.checklistRow, styles.checklistRowBorder]}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="map" size={11} />
            </View>
            <Text style={styles.checklistLabel}>Pedido #{delivery?.short_id ?? '—'}</Text>
          </View>
          <View style={[styles.checklistRow, styles.checklistRowBorder]}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="zap" size={11} />
            </View>
            <Text style={styles.checklistLabel}>Taxa: {delivery?.delivery_fee ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.proofSection}>
          <Text style={styles.proofTitle}>Foto de comprovante</Text>
          <Text style={styles.proofSubtitle}>
            Fotografe o pedido entregue na porta do cliente.
          </Text>

          {proofUri ? (
            <View style={styles.proofPreviewWrapper}>
              <Image contentFit="cover" source={{ uri: proofUri }} style={styles.proofPreview} />
              <Pressable onPress={handleTakeProofPhoto} style={styles.retakeBtn}>
                <Feather color="#fff" name="camera" size={14} />
                <Text style={styles.retakeBtnText}>Refazer foto</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable disabled={isBusy} onPress={handleTakeProofPhoto} style={styles.proofCapture}>
              <Feather color={SuwaveColors.muted} name="camera" size={28} />
              <Text style={styles.proofCaptureText}>Tirar foto do comprovante</Text>
            </Pressable>
          )}
        </View>

        <FormToast message={message} />

        <ActionButton disabled={isBusy || !proofFileId} loading={isBusy} onPress={handleComplete}>
          Concluir entrega
        </ActionButton>
        <ActionButton onPress={() => router.replace('/dashboard')} secondary>
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
    paddingHorizontal: 24,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
    gap: 14,
  },
  map: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
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
  checklist: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8edf1',
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  checklistRowBorder: {
    borderTopWidth: 1,
    borderTopColor: SuwaveColors.line,
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
  proofSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    padding: 18,
    gap: 10,
  },
  proofTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: SuwaveColors.ink,
  },
  proofSubtitle: {
    fontSize: 13,
    color: SuwaveColors.muted,
    lineHeight: 18,
  },
  proofCapture: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: SuwaveColors.line,
    borderStyle: 'dashed',
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  proofCaptureText: {
    fontSize: 14,
    fontWeight: '700',
    color: SuwaveColors.muted,
  },
  proofPreviewWrapper: {
    gap: 8,
  },
  proofPreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: SuwaveColors.ink,
    borderRadius: 8,
    paddingVertical: 10,
  },
  retakeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
