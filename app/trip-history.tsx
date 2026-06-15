import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { DriverHistoryItem, listDriverHistory } from '@/services/driver-client';
import { HISTORY_FILTERS, HistoryFilter } from '@/utils/finance';

/**
 * Equivalente nativo da tela `trip-history` (`TripHistory`) em
 * app/motorista/src/app/page.tsx:4582-4878.
 */
export default function TripHistoryScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<DriverHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
  const [selectedItem, setSelectedItem] = useState<DriverHistoryItem | null>(null);

  const loadHistory = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    listDriverHistory(token)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredItems = useMemo(() => {
    const sorted = [...items];
    if (activeFilter === 'all') return sorted;
    if (activeFilter === 'completed') return sorted.filter((item) => item.status_tone === 'completed');
    if (activeFilter === 'cancelled') return sorted.filter((item) => item.status_tone === 'cancelled');
    return sorted.filter((item) => item.type === activeFilter);
  }, [items, activeFilter]);

  const countByFilter = useMemo(() => {
    const counts: Record<HistoryFilter, number> = { all: items.length, ride: 0, delivery: 0, planned_trip: 0, completed: 0, cancelled: 0 };
    for (const item of items) {
      if (item.type === 'ride') counts.ride += 1;
      if (item.type === 'delivery') counts.delivery += 1;
      if (item.type === 'planned_trip') counts.planned_trip += 1;
      if (item.status_tone === 'completed') counts.completed += 1;
      if (item.status_tone === 'cancelled') counts.cancelled += 1;
    }
    return counts;
  }, [items]);

  const activeFilterInfo = HISTORY_FILTERS.find((filter) => filter.key === activeFilter);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar para o painel" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
            <Feather color="#071a36" name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.title}>Histórico de viagens</Text>
          <Pressable accessibilityLabel="Registrar nova viagem" onPress={() => router.push('/register-trip')} style={styles.headerButton}>
            <Feather color="#071a36" name="plus" size={22} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.tabs} horizontal showsHorizontalScrollIndicator={false}>
          {HISTORY_FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            const count = countByFilter[filter.key];

            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={[styles.tab, active && styles.tabActive]}>
                <Feather color={active ? SuwaveColors.black : '#667f90'} name={filter.icon as keyof typeof Feather.glyphMap} size={16} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{filter.label}</Text>
                {count > 0 ? (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionTitleRow}>
          <Feather color="#071a36" name={(activeFilterInfo?.icon ?? 'calendar') as keyof typeof Feather.glyphMap} size={18} />
          <Text style={styles.sectionTitle}>{activeFilterInfo?.label ?? 'Viagens'}</Text>
          {filteredItems.length > 0 ? <Text style={styles.sectionCount}>({filteredItems.length})</Text> : null}
        </View>

        <FormToast message={error} />

        {isLoading ? (
          <View style={{ gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ gap: 8, padding: 16, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf1' }}>
                <SkeletonBox height={14} width="40%" />
                <SkeletonBox height={18} width="70%" />
                <SkeletonBox height={13} width="50%" />
              </View>
            ))}
          </View>
        ) : null}

        {!isLoading && filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather color="#9db4bd" name="map" size={40} />
            <Text style={styles.emptyStateTitle}>
              {activeFilter === 'all' ? 'Nenhuma viagem ainda' : `Sem itens em "${activeFilterInfo?.label}"`}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeFilter === 'all'
                ? 'Suas corridas e entregas aparecerão aqui após a conclusão.'
                : 'Tente outro filtro ou aguarde novas viagens.'}
            </Text>
          </View>
        ) : null}

        {!isLoading && filteredItems.length > 0 ? (
          <View style={styles.list}>
            {filteredItems.map((item) => (
              <TripHistoryCard item={item} key={`${item.type}-${item.id}`} onPress={() => setSelectedItem(item)} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <TripReceiptModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </SafeAreaView>
  );
}

function TripReceiptModal({ item, onClose }: { item: DriverHistoryItem | null; onClose: () => void }) {
  if (!item) return null;

  const tone = item.status_tone;
  const badgeStyle = tone === 'completed' ? styles.badgeCompleted : tone === 'cancelled' ? styles.badgeCancelled : styles.badgeScheduled;
  const typeLabel = item.type === 'ride' ? 'Corrida' : item.type === 'delivery' ? 'Entrega' : 'Viagem planejada';
  const typeIcon: keyof typeof Feather.glyphMap = item.type === 'ride' ? 'navigation' : item.type === 'delivery' ? 'package' : 'map';

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <Pressable onPress={onClose} style={styles.receiptOverlay}>
        <Pressable style={styles.receiptSheet}>
          <View style={styles.receiptHandle} />

          <View style={styles.receiptHeader}>
            <View style={styles.receiptTitleRow}>
              <View style={[styles.receiptIcon, tone === 'completed' ? styles.iconCompleted : tone === 'cancelled' ? styles.iconCancelled : styles.iconScheduled]}>
                <Feather color="#fff" name={typeIcon} size={18} />
              </View>
              <View style={styles.receiptTitleCopy}>
                <Text style={styles.receiptTitle}>{item.title}</Text>
                <Text style={styles.receiptSub}>{typeLabel} · {item.date_label}</Text>
              </View>
            </View>
            <Pressable accessibilityLabel="Fechar" onPress={onClose} style={styles.receiptClose}>
              <Feather color="#071a36" name="x" size={18} />
            </Pressable>
          </View>

          {item.subtitle ? (
            <View style={styles.receiptAddressRow}>
              <Feather color="#9aabb8" name="map-pin" size={14} />
              <Text style={styles.receiptAddress}>{item.subtitle}</Text>
            </View>
          ) : null}

          <View style={styles.receiptDivider} />

          <View style={styles.receiptStatusRow}>
            <Text style={styles.receiptStatusLabel}>Status</Text>
            <View style={[styles.badge, badgeStyle]}>
              <Text style={styles.badgeText}>{item.status_label}</Text>
            </View>
          </View>

          {item.distance_label ? (
            <View style={styles.receiptStatusRow}>
              <Text style={styles.receiptStatusLabel}>Distância</Text>
              <Text style={styles.receiptStatusValue}>{item.distance_label}</Text>
            </View>
          ) : null}

          <View style={styles.receiptDivider} />

          {item.metrics.length > 0 ? (
            <View style={styles.receiptMetricsGrid}>
              {item.metrics.map((m) => (
                <View key={m.label} style={styles.receiptMetricCard}>
                  <Text style={styles.receiptMetricLabel}>{m.label}</Text>
                  <Text style={styles.receiptMetricValue}>{m.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TripHistoryCard({ item, onPress }: { item: DriverHistoryItem; onPress: () => void }) {
  const tone = item.status_tone;
  const toneStyle = tone === 'completed' ? styles.iconCompleted : tone === 'cancelled' ? styles.iconCancelled : styles.iconScheduled;
  const badgeStyle = tone === 'completed' ? styles.badgeCompleted : tone === 'cancelled' ? styles.badgeCancelled : styles.badgeScheduled;
  const iconName: keyof typeof Feather.glyphMap = tone === 'completed' ? 'check' : item.type === 'ride' || item.type === 'delivery' ? 'truck' : 'calendar';

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.cardIcon, toneStyle]}>
        <Feather color="#fff" name={iconName} size={18} />
      </View>
      <View style={styles.cardMain}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
        <Text style={styles.cardSubtitle}>{item.date_label}</Text>
      </View>
      <View style={styles.cardMetrics}>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{item.status_label}</Text>
        </View>
        <Text style={styles.cardDistance}>{item.distance_label}</Text>
      </View>
      <Feather color="#9aabb8" name="chevron-right" size={20} />
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
    fontSize: 24,
    fontWeight: '900',
    color: '#071a36',
    textAlign: 'center',
  },
  tabs: {
    gap: 8,
    paddingVertical: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e7eef2',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: SuwaveColors.yellow,
    borderColor: SuwaveColors.yellow,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#667f90',
  },
  tabLabelActive: {
    color: SuwaveColors.black,
  },
  tabCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2f5',
  },
  tabCountActive: {
    backgroundColor: 'rgba(8, 8, 8, 0.16)',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#667f90',
  },
  tabCountTextActive: {
    color: SuwaveColors.black,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9aabb8',
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
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#243949',
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#667f90',
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconScheduled: {
    backgroundColor: '#ffb800',
  },
  iconCompleted: {
    backgroundColor: '#25a64a',
  },
  iconCancelled: {
    backgroundColor: '#d92525',
  },
  cardMain: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#071a36',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#667f90',
  },
  cardMetrics: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeScheduled: {
    backgroundColor: '#fff3cf',
  },
  badgeCompleted: {
    backgroundColor: '#e3f7ea',
  },
  badgeCancelled: {
    backgroundColor: '#fbe4e4',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#071a36',
  },
  cardDistance: {
    fontSize: 13,
    fontWeight: '800',
    color: '#071a36',
  },
  receiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 24, 36, 0.4)',
    justifyContent: 'flex-end',
  },
  receiptSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  receiptHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dce6ec',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  receiptIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  receiptTitleCopy: {
    flex: 1,
    gap: 3,
  },
  receiptTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#071a36',
  },
  receiptSub: {
    fontSize: 13,
    color: '#667f90',
  },
  receiptClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f7f8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  receiptAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  receiptAddress: {
    flex: 1,
    fontSize: 14,
    color: '#667f90',
    lineHeight: 19,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#e8edf1',
    marginVertical: 12,
  },
  receiptStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptStatusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#071a36',
  },
  receiptStatusValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#071a36',
  },
  receiptMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  receiptMetricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#f6f9fb',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  receiptMetricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  receiptMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#071a36',
  },
});
