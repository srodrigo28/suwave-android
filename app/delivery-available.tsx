import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { AppHeader } from '@/components/motorista/app-header';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { acceptDriverDelivery } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

export default function DeliveryAvailableScreen() {
  const { token } = useAuth();
  const delivery = useDriverFlowStore((state) => state.pendingDelivery);
  const setPendingDelivery = useDriverFlowStore((state) => state.setPendingDelivery);
  const setActiveDelivery = useDriverFlowStore((state) => state.setActiveDelivery);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function handleAccept() {
    if (!token || !delivery) { router.replace('/delivery-accepted'); return; }
    setIsBusy(true);
    setMessage('');
    try {
      const accepted = await acceptDriverDelivery(token, delivery.id);
      setPendingDelivery(null);
      setActiveDelivery(accepted);
      router.replace('/delivery-accepted');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível aceitar a entrega.');
    } finally {
      setIsBusy(false);
    }
  }

  function handleDecline() {
    setPendingDelivery(null);
    router.replace('/dashboard');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader onBack={() => router.replace('/dashboard')} />

        <View style={styles.successBox}>
          <Feather color="#f2b100" name="package" size={32} style={styles.successIcon} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Nova entrega disponível</Text>
            <Text style={styles.successText}>{delivery?.seller ?? 'Estabelecimento SUWAVE'}</Text>
          </View>
        </View>

        <View style={styles.checklist}>
          <View style={styles.checklistRow}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="map-pin" size={11} />
            </View>
            <Text style={styles.checklistLabel}>{delivery?.address ?? 'Endereço de entrega'}</Text>
          </View>
          {delivery?.items_count ? (
            <View style={[styles.checklistRow, styles.checklistRowBorder]}>
              <View style={styles.checklistIcon}>
                <Feather color="#fff" name="shopping-bag" size={11} />
              </View>
              <Text style={styles.checklistLabel}>{delivery.items_count} iten(s) no pedido</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Pedido</Text>
            <Text style={styles.cardValue}>#{delivery?.short_id ?? '—'}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Itens</Text>
            <Text style={styles.cardValue}>{delivery?.items_count ?? '—'}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Taxa</Text>
            <Text style={styles.cardValue}>{delivery?.delivery_fee ?? '—'}</Text>
          </View>
        </View>

        <FormToast message={message} />

        <ActionButton disabled={isBusy} loading={isBusy} onPress={handleAccept}>
          Aceitar entrega
        </ActionButton>
        <ActionButton disabled={isBusy} onPress={handleDecline} secondary>
          Recusar
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
    marginVertical: 18,
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
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#f6fbf8',
    borderWidth: 1,
    borderColor: '#cfe7dc',
    borderRadius: 8,
    padding: 13,
    marginBottom: 8,
  },
  cardItem: {
    flex: 1,
    gap: 3,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b8090',
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#133343',
  },
});
