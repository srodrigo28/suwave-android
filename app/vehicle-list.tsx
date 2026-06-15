import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/motorista/app-header';
import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { DriverVehicle, getDriverProfile } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

/**
 * Equivalente nativo da tela `vehicle-list` (`VehicleListScreen`) em
 * app/motorista/src/app/page.tsx:3767-3885.
 */
export default function VehicleListScreen() {
  const { token } = useAuth();
  const setEditingVehicleId = useDriverFlowStore((state) => state.setEditingVehicleId);
  const setSelectedBrand = useDriverFlowStore((state) => state.setSelectedBrand);
  const setVehicleForm = useDriverFlowStore((state) => state.setVehicleForm);
  const setVehicleUploads = useDriverFlowStore((state) => state.setVehicleUploads);

  const [vehicles, setVehicles] = useState<DriverVehicle[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getDriverProfile(token)
      .then((profile) => { if (!cancelled) setVehicles(profile.vehicles); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar seus veículos.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  function handleEditVehicle(vehicle: DriverVehicle) {
    setEditingVehicleId(vehicle.id);
    setSelectedBrand({ codigo: normalizeBrandName(vehicle.brand), nome: vehicle.brand });
    setVehicleForm({
      model: vehicle.model,
      plate: vehicle.plate,
      year: vehicle.year == null ? '' : String(vehicle.year),
    });
    setVehicleUploads({
      front: vehicle.front_photo_url ? { uri: vehicle.front_photo_url, name: 'front.jpg', type: 'image/jpeg', size: 0 } : undefined,
      interior: vehicle.interior_photo_url ? { uri: vehicle.interior_photo_url, name: 'interior.jpg', type: 'image/jpeg', size: 0 } : undefined,
      rear: vehicle.rear_photo_url ? { uri: vehicle.rear_photo_url, name: 'rear.jpg', type: 'image/jpeg', size: 0 } : undefined,
      side: vehicle.side_photo_url ? { uri: vehicle.side_photo_url, name: 'side.jpg', type: 'image/jpeg', size: 0 } : undefined,
    });
    router.push('/vehicle-photos');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader onBack={() => router.replace('/dashboard')} />

        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Meus veículos</Text>
            <Text style={styles.subtitle}>Gerencie os veículos cadastrados.</Text>
          </View>
          <Pressable
            accessibilityLabel="Adicionar veículo"
            onPress={() => router.push('/vehicle-mode')}
            style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

        <FormToast message={error} />

        {isLoading ? (
          <View style={styles.list}>
            <VehicleCardSkeleton />
            <VehicleCardSkeleton />
          </View>
        ) : vehicles.length > 0 ? (
          <View style={styles.list}>
            {vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} onPress={() => handleEditVehicle(vehicle)} vehicle={vehicle} />
            ))}
          </View>
        ) : (
          <Pressable onPress={() => router.push('/vehicle-mode')} style={styles.addCard}>
            <View style={styles.addCardImage}>
              <Image resizeMode="contain" source={SuwaveAssets.loginHero} style={styles.addCardImageSource} />
            </View>
            <View style={styles.addCardCopy}>
              <Text style={styles.addCardTitle}>Adicionar veículo</Text>
              <Text style={styles.addCardSubtitle}>Cadastre seu veículo para receber corridas.</Text>
            </View>
            <Feather color="#071a36" name="chevron-right" size={22} />
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function VehicleCardSkeleton() {
  return (
    <View style={styles.vehicleCard}>
      <SkeletonBox borderRadius={8} height={64} width={90} />
      <View style={styles.vehicleCardCopy}>
        <SkeletonBox height={16} width="70%" />
        <SkeletonBox height={13} width="45%" />
        <SkeletonBox height={13} width="35%" />
      </View>
    </View>
  );
}

function normalizeBrandName(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function getVehicleStatusLabel(status?: string | null) {
  if (!status) return 'Em análise';
  switch (status.toUpperCase()) {
    case 'APROVADO': return 'Ativo';
    case 'REJEITADO': return 'Reprovado';
    case 'PENDENTE': return 'Em análise';
    default: return status;
  }
}

function formatVehicleYear(value?: string | number | null) {
  if (value == null || value === '') return 'Não informado';
  return String(value);
}

function VehicleCard({ vehicle, onPress }: { vehicle: DriverVehicle; onPress: () => void }) {
  const imageUri = vehicle.front_photo_url ?? vehicle.side_photo_url ?? vehicle.rear_photo_url ?? vehicle.interior_photo_url ?? null;
  const isApproved = vehicle.status?.toUpperCase() === 'APROVADO';
  const statusLabel = getVehicleStatusLabel(vehicle.status);

  return (
    <Pressable onPress={onPress} style={styles.vehicleCard}>
      <View style={styles.vehicleCardImage}>
        {imageUri ? (
          <Image resizeMode="cover" source={{ uri: imageUri }} style={styles.vehicleCardImageSource} />
        ) : (
          <Image resizeMode="contain" source={SuwaveAssets.loginHero} style={styles.vehicleCardImageSource} />
        )}
      </View>
      <View style={styles.vehicleCardCopy}>
        <View style={styles.vehicleCardTopLine}>
          <Text style={styles.vehicleCardName}>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}</Text>
          <Text style={[styles.vehicleCardStatus, isApproved && styles.vehicleCardStatusApproved]}>{statusLabel}</Text>
        </View>
        <Text style={styles.vehicleCardDetail}>Placa: {vehicle.plate || 'Não informada'}</Text>
        <Text style={styles.vehicleCardDetail}>Ano: {formatVehicleYear(vehicle.year)}</Text>
        {vehicle.color ? <Text style={styles.vehicleCardDetail}>Cor: {vehicle.color}</Text> : null}
      </View>
      <Feather color="#071a36" name="chevron-right" size={22} />
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
    paddingHorizontal: 24,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 10,
  },
  titleCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0a2d43',
  },
  subtitle: {
    fontSize: 15,
    color: '#637786',
    lineHeight: 19,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0a2d43',
    lineHeight: 30,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eef0f4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 1,
  },
  addCardImage: {
    width: 100,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardImageSource: {
    width: '100%',
    height: '100%',
  },
  addCardCopy: {
    flex: 1,
    gap: 2,
  },
  addCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
  },
  addCardSubtitle: {
    fontSize: 14,
    color: '#59677c',
  },
  list: {
    gap: 12,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eef0f4',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 1,
  },
  vehicleCardImage: {
    width: 90,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eef2f5',
  },
  vehicleCardImageSource: {
    width: '100%',
    height: '100%',
  },
  vehicleCardCopy: {
    flex: 1,
    gap: 2,
  },
  vehicleCardTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  vehicleCardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#071a36',
  },
  vehicleCardStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#667f90',
    backgroundColor: '#eef2f5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vehicleCardStatusApproved: {
    color: '#0a5c3a',
    backgroundColor: '#d4f5e4',
  },
  vehicleCardDetail: {
    fontSize: 13,
    color: '#59677c',
  },
});
