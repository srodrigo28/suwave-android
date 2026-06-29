import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { DriverEarnings, DriverEarningsDailyBreakdown, DriverEarningsHistory, getDriverEarnings } from '@/services/driver-client';
import {
  formatOnlineDuration,
  formatPeriodRangeLabel,
  getWeekRange,
  getWeekdayLabel,
} from '@/utils/finance';

function formatDistanceMeters(meters: number): string {
  if (meters === 0) return '0 km';
  return `${(meters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

export default function FinanceScreen() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [earnings, setEarnings] = useState<DriverEarnings | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTrip, setSelectedTrip] = useState<DriverEarningsHistory | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const slideX = useSharedValue(0);
  const slideOpacity = useSharedValue(1);

  const slideStyle = useAnimatedStyle(() => ({
    opacity: slideOpacity.value,
    transform: [{ translateX: slideX.value }],
  }));

  function navigateWeek(dir: 'prev' | 'next') {
    if (dir === 'next' && weekOffset >= 0) return;
    const enterFrom = dir === 'prev' ? -36 : 36;
    slideX.value = withSequence(withTiming(enterFrom, { duration: 0 }), withTiming(0, { duration: 220 }));
    slideOpacity.value = withSequence(withTiming(0.2, { duration: 0 }), withTiming(1, { duration: 220 }));
    setWeekOffset((prev) => prev + (dir === 'prev' ? -1 : 1));
    setSelectedDate(null);
  }

  const range = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const rangeLabel = formatPeriodRangeLabel(range.start, range.end);

  const dailyBreakdown = earnings?.daily_breakdown ?? [];
  const periodHistory = earnings?.period_history ?? [];

  const displayedHistory = selectedDate
    ? periodHistory.filter((item) => item.created_at.startsWith(selectedDate))
    : periodHistory;

  const selectedDayBreakdown = selectedDate
    ? dailyBreakdown.find((d) => d.date === selectedDate) ?? null
    : null;

  const displayedTripCount = selectedDayBreakdown != null
    ? (selectedDayBreakdown.trip_count ?? displayedHistory.length)
    : (earnings?.viagens_count ?? 0);

  const displayedOnlineSeconds = selectedDayBreakdown != null
    ? (selectedDayBreakdown.online_seconds ?? 0)
    : (earnings?.online_seconds ?? 0);

  const displayedDistanceMeters: number | null = selectedDayBreakdown != null
    ? (selectedDayBreakdown.distance_meters_total ?? 0)
    : null;

  const displayedPoints = selectedDate
    ? displayedHistory.length * 10
    : (earnings?.points_score ?? 0);

  const loadFinance = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    getDriverEarnings(token, { start: range.start, end: range.end })
      .then((data) => { setEarnings(data); setSelectedDate(null); })
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

        {/* Navegação semanal */}
        <View style={styles.weekNav}>
          <Pressable
            accessibilityLabel="Semana anterior"
            onPress={() => navigateWeek('prev')}
            style={styles.weekBtn}
          >
            <Feather color="#071a36" name="chevron-left" size={22} />
          </Pressable>
          <View style={styles.weekInfo}>
            <Feather color="#071a36" name="calendar" size={14} />
            <Text style={styles.weekLabel}>7 dias</Text>
            <Text style={styles.weekDot}>·</Text>
            <Text style={styles.weekRange}>{rangeLabel}</Text>
          </View>
          <Pressable
            accessibilityLabel="Próxima semana"
            disabled={weekOffset >= 0}
            onPress={() => navigateWeek('next')}
            style={[styles.weekBtn, weekOffset >= 0 && styles.weekBtnDisabled]}
          >
            <Feather color={weekOffset >= 0 ? '#c9d6de' : '#071a36'} name="chevron-right" size={22} />
          </Pressable>
        </View>

        <Animated.View style={slideStyle}>
        <View style={styles.totalBlock}>
          <View style={styles.totalMeta}>
            <Text style={styles.totalLabel}>
              {selectedDate ? getWeekdayLabel(selectedDate) : 'Ganhos no período'}
            </Text>
            {selectedDate ? (
              <Pressable
                accessibilityLabel="Ver todos os dias"
                onPress={() => setSelectedDate(null)}
                style={styles.clearBtn}
              >
                <Feather color="#fff" name="x" size={10} />
                <Text style={styles.clearBtnText}>Ver todos</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.totalValue}>
            {selectedDate
              ? (selectedDayBreakdown?.amount ?? 'R$ 0,00')
              : (earnings?.period_total ?? 'R$ 0,00')}
          </Text>
        </View>

        <View style={styles.chart}>
          {chartDays.map((day, index) => {
            const heightPercent = Math.max(4, Math.round((day.amount_cents / maxCents) * 100));
            const isSelected = selectedDate === day.date;
            return (
              <AnimatedBar
                heightPercent={heightPercent}
                index={index}
                key={day.date}
                label={getWeekdayLabel(day.date)}
                selected={isSelected}
                onPress={() => setSelectedDate(isSelected ? null : day.date)}
              />
            );
          })}
        </View>

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Feather color="#071a36" name="clock" size={20} />
            <Text style={styles.statValue}>{formatOnlineDuration(displayedOnlineSeconds)}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
          <View style={styles.statCard}>
            <Feather color="#071a36" name="map" size={20} />
            <Text style={styles.statValue}>{displayedTripCount}</Text>
            <Text style={styles.statLabel}>Viagens</Text>
          </View>
          {displayedDistanceMeters != null ? (
            <View style={styles.statCard}>
              <Feather color="#071a36" name="navigation" size={20} />
              <Text style={styles.statValue}>{formatDistanceMeters(displayedDistanceMeters)}</Text>
              <Text style={styles.statLabel}>Km rodado</Text>
            </View>
          ) : (
            <View style={styles.statCard}>
              <Feather color="#071a36" name="zap" size={20} />
              <Text style={styles.statValue}>{displayedPoints}</Text>
              <Text style={styles.statLabel}>Pontos</Text>
            </View>
          )}
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

        {!isLoading && displayedHistory.length === 0 && !selectedDate ? (
          <View style={styles.emptyState}>
            <Feather color="#9db4bd" name="dollar-sign" size={40} />
            <Text style={styles.emptyStateTitle}>Sem movimentações</Text>
            <Text style={styles.emptyStateText}>Nenhum registro financeiro encontrado para este período.</Text>
          </View>
        ) : null}

        {!isLoading && displayedHistory.length === 0 && selectedDate ? (
          <View style={styles.emptyState}>
            <Feather color="#9db4bd" name="dollar-sign" size={40} />
            <Text style={styles.emptyStateTitle}>Sem viagens</Text>
            <Text style={styles.emptyStateText}>Nenhuma viagem em {getWeekdayLabel(selectedDate)}.</Text>
          </View>
        ) : null}

        {!isLoading && displayedHistory.length > 0 ? (
          <View style={styles.historyList}>
            <Text style={styles.historyTitle}>
              {selectedDate ? getWeekdayLabel(selectedDate) : 'Histórico do período'}
            </Text>
            {displayedHistory.map((item) => (
              <FinanceHistoryCard key={`${item.type}-${item.id}`} item={item} onPress={() => setSelectedTrip(item)} />
            ))}
          </View>
        ) : null}
        </Animated.View>
      </ScrollView>

      <TripDetailModal onClose={() => setSelectedTrip(null)} trip={selectedTrip} />
    </SafeAreaView>
  );
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  CONCLUIDA:  { label: 'Concluída',  color: '#0a6b4f', bg: '#e6f7f0' },
  delivered:  { label: 'Entregue',   color: '#0a6b4f', bg: '#e6f7f0' },
  RECUSADA:   { label: 'Cancelada',  color: '#b91c1c', bg: '#fdecea' },
  ACEITA:     { label: 'Aceita',     color: '#2f6fed', bg: '#e8f0fe' },
};

function FinanceHistoryCard({ item, onPress }: { item: DriverEarningsHistory; onPress: () => void }) {
  const statusInfo = STATUS_MAP[item.status] ?? { label: item.status, color: '#667f90', bg: '#f1f5f7' };
  const isCancelled = item.status === 'RECUSADA';

  return (
    <Pressable onPress={onPress} style={styles.historyItem}>
      <View style={[styles.historyItemIcon, { backgroundColor: statusInfo.bg }]}>
        <Feather
          color={statusInfo.color}
          name={item.type === 'delivery' ? 'package' : item.type === 'planned_trip' ? 'map' : 'navigation'}
          size={14}
        />
      </View>
      <View style={styles.historyItemCopy}>
        <Text style={styles.historyItemTitle}>{item.title}</Text>
        {item.type === 'delivery'
          ? (item.description ? <Text style={styles.historyItemSub}>{item.description}</Text> : null)
          : (item.description ? <Text style={styles.historyItemSub}>{item.description}</Text> : null)}
        <Text style={styles.historyItemMeta}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</Text>
      </View>
      <View style={styles.historyItemRight}>
        <Text style={[styles.historyItemAmount, isCancelled && { color: '#b91c1c' }]}>
          {item.amount_cents > 0 ? item.amount : 'R$ 0,00'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function AnimatedBar({
  heightPercent,
  index,
  label,
  selected,
  onPress,
}: {
  heightPercent: number;
  index: number;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withDelay(index * 60, withTiming(heightPercent, { duration: 500 }));
  }, [height, heightPercent, index]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${height.value}%` as `${number}%` }));

  return (
    <Pressable onPress={onPress} style={styles.chartBar}>
      <View style={[styles.chartBarTrack, selected && styles.chartBarTrackSelected]}>
        <Animated.View style={[styles.chartBarFill, fillStyle, selected && styles.chartBarFillSelected]} />
      </View>
      <Text style={[styles.chartBarLabel, selected && styles.chartBarLabelSelected]}>{label}</Text>
    </Pressable>
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
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  weekBtn: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f8fa',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
  },
  weekBtnDisabled: {
    opacity: 0.4,
  },
  weekInfo: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: '#f5f8fa',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e7eef2',
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#071a36',
  },
  weekDot: {
    fontSize: 12,
    color: '#c0cdd5',
    fontWeight: '700',
  },
  weekRange: {
    fontSize: 11,
    color: '#667f90',
    fontWeight: '700',
  },
  totalBlock: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  totalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0a6b4f',
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
  chartBarTrackSelected: {
    backgroundColor: '#c8d8e4',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 7,
    backgroundColor: SuwaveColors.yellow,
  },
  chartBarFillSelected: {
    backgroundColor: '#071a36',
  },
  chartBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9aabb8',
  },
  chartBarLabelSelected: {
    color: '#071a36',
    fontWeight: '900',
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
    color: '#0a6b4f',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
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
