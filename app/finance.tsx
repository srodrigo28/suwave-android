import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { DriverEarnings, DriverEarningsDailyBreakdown, DriverEarningsHistory, getDriverEarnings } from '@/services/driver-client';
import {
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  PeriodKey,
  formatOnlineDuration,
  formatPeriodRangeLabel,
  getPeriodRange,
  getWeekdayLabel,
} from '@/utils/finance';

/**
 * Equivalente nativo da tela `finance` (`FinanceScreen`) em
 * app/motorista/src/app/page.tsx:5264-5394.
 */
export default function FinanceScreen() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [earnings, setEarnings] = useState<DriverEarnings | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('7d');
  const [customRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<DriverEarningsHistory | null>(null);

  const range = useMemo(() => getPeriodRange(period, customRange), [period, customRange]);
  const rangeLabel = formatPeriodRangeLabel(range.start, range.end);

  const dailyBreakdown = earnings?.daily_breakdown ?? [];
  const periodHistory = earnings?.period_history ?? [];

  const loadFinance = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    getDriverEarnings(token, { start: range.start, end: range.end })
      .then(setEarnings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar ganhos.'))
      .finally(() => setIsLoading(false));
  }, [token, range.start, range.end]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const chartDays = dailyBreakdown.length > 0 ? dailyBreakdown : getPlaceholderDays(range.start, range.end);
  const maxCents = Math.max(1, ...chartDays.map((day) => day.amount_cents));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar para o painel" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
            <Feather color="#071a36" name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.title}>Ganhos</Text>
          <Pressable accessibilityLabel="Atualizar financeiro" onPress={loadFinance} style={styles.headerButton}>
            <Feather color="#071a36" name="refresh-cw" size={22} />
          </Pressable>
        </View>

        <Pressable onPress={() => setShowPeriodSheet(true)} style={styles.periodTrigger}>
          <Feather color="#071a36" name="calendar" size={20} />
          <View style={styles.periodCopy}>
            <Text style={styles.periodLabel}>{PERIOD_LABELS[period]}</Text>
            <Text style={styles.periodRange}>{rangeLabel}</Text>
          </View>
          <Feather color="#9aabb8" name="chevron-right" size={20} />
        </Pressable>

        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>Ganhos no período</Text>
          <Text style={styles.totalValue}>{earnings ? `R$ ${(earnings.period_total_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00'}</Text>
        </View>

        <View style={styles.chart}>
          {chartDays.map((day, index) => {
            const heightPercent = Math.max(4, Math.round((day.amount_cents / maxCents) * 100));
            return (
              <AnimatedBar
                heightPercent={heightPercent}
                index={index}
                key={day.date}
                label={getWeekdayLabel(day.date)}
              />
            );
          })}
        </View>

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Feather color="#071a36" name="clock" size={20} />
            <Text style={styles.statValue}>{formatOnlineDuration(earnings?.online_seconds ?? 0)}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
          <View style={styles.statCard}>
            <Feather color="#071a36" name="map" size={20} />
            <Text style={styles.statValue}>{earnings?.viagens_count ?? 0}</Text>
            <Text style={styles.statLabel}>Viagens</Text>
          </View>
          <View style={styles.statCard}>
            <Feather color="#071a36" name="zap" size={20} />
            <Text style={styles.statValue}>{earnings?.points_score ?? 0}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
        </View>

        <FormToast message={error} />

        {isLoading ? (
          <View style={{ gap: 10 }}>
            <SkeletonBox height={80} borderRadius={10} />
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ gap: 6 }}>
                <SkeletonBox height={13} width="25%" />
                <SkeletonBox height={16} width="60%" />
              </View>
            ))}
          </View>
        ) : null}
        {!isLoading && periodHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather color="#9db4bd" name="dollar-sign" size={40} />
            <Text style={styles.emptyStateTitle}>Sem movimentações</Text>
            <Text style={styles.emptyStateText}>Nenhum registro financeiro encontrado para este período.</Text>
          </View>
        ) : null}

        {!isLoading && periodHistory.length > 0 ? (
          <View style={styles.historyList}>
            <Text style={styles.historyTitle}>Histórico do período</Text>
            {periodHistory.map((item) => (
              <Pressable key={item.id} onPress={() => setSelectedTrip(item)} style={styles.historyItem}>
                <View style={styles.historyItemIcon}>
                  <Feather
                    color="#fff"
                    name={item.type === 'delivery' ? 'package' : item.type === 'planned_trip' ? 'map' : 'navigation'}
                    size={14}
                  />
                </View>
                <View style={styles.historyItemCopy}>
                  <Text style={styles.historyItemTitle}>{item.title}</Text>
                  {item.origin_label ? <Text style={styles.historyItemSub}>{item.origin_label}</Text> : null}
                  {item.distance_label ? <Text style={styles.historyItemMeta}>{item.distance_label}{item.duration_label ? ` · ${item.duration_label}` : ''}</Text> : null}
                </View>
                <View style={styles.historyItemRight}>
                  <Text style={styles.historyItemAmount}>{item.amount}</Text>
                  <Feather color="#9aabb8" name="chevron-right" size={16} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <TripDetailModal onClose={() => setSelectedTrip(null)} trip={selectedTrip} />

      <Modal animationType="fade" onRequestClose={() => setShowPeriodSheet(false)} transparent visible={showPeriodSheet}>
        <Pressable onPress={() => setShowPeriodSheet(false)} style={styles.sheetOverlay}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Selecionar período</Text>
              <Pressable accessibilityLabel="Fechar seleção de período" onPress={() => setShowPeriodSheet(false)} style={styles.sheetClose}>
                <Feather color="#071a36" name="x" size={18} />
              </Pressable>
            </View>

            <View style={styles.sheetOptions}>
              {PERIOD_OPTIONS.map((option) => {
                const active = period === option;
                return (
                  <Pressable
                    accessibilityState={{ selected: active }}
                    key={option}
                    onPress={() => {
                      setPeriod(option);
                      setShowPeriodSheet(false);
                    }}
                    style={[styles.sheetOption, active && styles.sheetOptionActive]}>
                    <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>{PERIOD_LABELS[option]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function AnimatedBar({ heightPercent, index, label }: { heightPercent: number; index: number; label: string }) {
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withDelay(index * 60, withTiming(heightPercent, { duration: 500 }));
  }, [height, heightPercent, index]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${height.value}%` as `${number}%` }));

  return (
    <View style={styles.chartBar}>
      <View style={styles.chartBarTrack}>
        <Animated.View style={[styles.chartBarFill, fillStyle]} />
      </View>
      <Text style={styles.chartBarLabel}>{label}</Text>
    </View>
  );
}

function getPlaceholderDays(start: string, end: string): DriverEarningsDailyBreakdown[] {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const days: DriverEarningsDailyBreakdown[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate && days.length < 7) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    days.push({ date: `${year}-${month}-${day}`, amount: 'R$ 0,00', amount_cents: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function TripDetailModal({ trip, onClose }: { trip: DriverEarningsHistory | null; onClose: () => void }) {
  if (!trip) return null;

  const hasOrigin = typeof trip.origin_latitude === 'number' && typeof trip.origin_longitude === 'number';
  const hasDest = typeof trip.destination_latitude === 'number' && typeof trip.destination_longitude === 'number';
  const hasRoute = (trip.route_geometry?.length ?? 0) > 0;

  const mapRegion = hasOrigin
    ? {
        latitude: trip.origin_latitude!,
        longitude: trip.origin_longitude!,
        latitudeDelta: hasDest
          ? Math.abs(trip.origin_latitude! - trip.destination_latitude!) * 2 + 0.02
          : 0.02,
        longitudeDelta: hasDest
          ? Math.abs(trip.origin_longitude! - trip.destination_longitude!) * 2 + 0.02
          : 0.02,
      }
    : null;

  const polylineCoords = hasRoute
    ? trip.route_geometry!.map((pt) => ({ latitude: pt.lat, longitude: pt.lng }))
    : [];

  const detailRows: [string, string | null | undefined][] = [
    ['Valor', trip.amount],
    ['Distância', trip.distance_label],
    ['Duração', trip.duration_label],
    ['Veículo', trip.vehicle_label],
    ['Lugares', trip.seats_label],
    ['Pagamento', trip.payment_label],
    ['Bagagem', trip.baggage_label],
    ['Tarifa', trip.fare_note],
  ];

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <Pressable onPress={onClose} style={styles.detailOverlay}>
        <Pressable style={styles.detailSheet}>
          <View style={styles.detailHandle} />
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{trip.title}</Text>
            <Pressable accessibilityLabel="Fechar" onPress={onClose} style={styles.detailClose}>
              <Feather color="#071a36" name="x" size={18} />
            </Pressable>
          </View>

          {mapRegion ? (
            <MapView provider={PROVIDER_GOOGLE} region={mapRegion} style={styles.detailMap}>
              {hasOrigin ? (
                <Marker coordinate={{ latitude: trip.origin_latitude!, longitude: trip.origin_longitude! }} title="Origem" />
              ) : null}
              {hasDest ? (
                <Marker
                  coordinate={{ latitude: trip.destination_latitude!, longitude: trip.destination_longitude! }}
                  pinColor="#25c684"
                  title="Destino"
                />
              ) : null}
              {hasRoute ? (
                <Polyline coordinates={polylineCoords} strokeColor={SuwaveColors.yellow} strokeWidth={3} />
              ) : null}
            </MapView>
          ) : null}

          <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
            {trip.origin_label ? (
              <View style={styles.detailRoute}>
                <View style={styles.detailRouteIcon}>
                  <Feather color="#fff" name="navigation" size={12} />
                </View>
                <Text style={styles.detailRouteLabel}>{trip.origin_label}</Text>
              </View>
            ) : null}
            {trip.destination_label ? (
              <View style={styles.detailRoute}>
                <View style={[styles.detailRouteIcon, { backgroundColor: '#25c684' }]}>
                  <Feather color="#fff" name="map-pin" size={12} />
                </View>
                <Text style={styles.detailRouteLabel}>{trip.destination_label}</Text>
              </View>
            ) : null}

            <View style={styles.detailGrid}>
              {detailRows
                .filter(([, val]) => val != null && val !== '')
                .map(([label, val]) => (
                  <View key={label} style={styles.detailGridItem}>
                    <Text style={styles.detailGridLabel}>{label}</Text>
                    <Text style={styles.detailGridValue}>{val}</Text>
                  </View>
                ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerButton: {
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
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
    color: '#071a36',
    textAlign: 'center',
  },
  periodTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 64,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  periodCopy: {
    flex: 1,
    gap: 2,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#071a36',
  },
  periodRange: {
    fontSize: 12,
    color: '#667f90',
  },
  totalBlock: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 4,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#071a36',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    height: '100%',
  },
  chartBarTrack: {
    flex: 1,
    width: 14,
    borderRadius: 7,
    backgroundColor: '#eef2f5',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 7,
    backgroundColor: SuwaveColors.yellow,
  },
  chartBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9aabb8',
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingVertical: 14,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  empty: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667f90',
    textAlign: 'center',
    paddingVertical: 24,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#243949',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#667f90',
    textAlign: 'center',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 24, 36, 0.3)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#071a36',
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f7f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptions: {
    gap: 8,
  },
  sheetOption: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7eef2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionActive: {
    backgroundColor: SuwaveColors.yellow,
    borderColor: SuwaveColors.yellow,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#071a36',
  },
  sheetOptionTextActive: {
    color: SuwaveColors.black,
  },
  historyList: {
    gap: 8,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
    marginBottom: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  historyItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyItemCopy: {
    flex: 1,
    gap: 2,
  },
  historyItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#071a36',
  },
  historyItemSub: {
    fontSize: 12,
    color: '#667f90',
  },
  historyItemMeta: {
    fontSize: 11,
    color: '#9aabb8',
    fontWeight: '700',
  },
  historyItemRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  historyItemAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#071a36',
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 24, 36, 0.4)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  detailHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dce6ec',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
    flex: 1,
  },
  detailClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f7f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMap: {
    height: 180,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  detailRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailRouteIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailRouteLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#243949',
    lineHeight: 19,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  detailGridItem: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#f6f9fb',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  detailGridLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  detailGridValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#071a36',
  },
});
