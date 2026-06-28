import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { getDriverEarnings } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { formatCurrency } from '@/utils/format';

function buildPixCode(pixKey: string, amount: number, name: string): string {
  const amountStr = amount.toFixed(2);
  const nameClean = name.slice(0, 25).toUpperCase();
  const pixPayload = [
    '000201',
    '010212',
    `2658${String(36 + pixKey.length).padStart(2, '0')}0014BR.GOV.BCB.PIX01${String(pixKey.length).padStart(2, '0')}${pixKey}`,
    '52040000',
    '5303986',
    `54${String(amountStr.length).padStart(2, '0')}${amountStr}`,
    '5802BR',
    `59${String(nameClean.length).padStart(2, '0')}${nameClean}`,
    '6009SAO PAULO',
    '62070503***',
  ].join('');
  return `${pixPayload}6304${crc16(pixPayload + '6304')}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xffff).toString(16).toUpperCase()).padStart(4, '0');
}

export default function RidePaymentScreen() {
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.activeRide);
  const [copied, setCopied] = useState(false);
  const [creditedNetFare, setCreditedNetFare] = useState<number | null>(null);

  const rawPayment = ride?.payment_method ?? 'dinheiro';
  const clientPayment = ride?.client_payment_method;
  const paymentMethod = clientPayment ?? rawPayment;
  const grossFare = ride?.gross_fare ?? ride?.driver_fare ?? creditedNetFare ?? 0;
  const netFare = ride?.net_fare ?? creditedNetFare ?? (
    ride?.platform_fee != null ? Math.max(grossFare - ride.platform_fee, 0) : grossFare
  );
  const platformFee = ride?.platform_fee ?? Math.max(grossFare - netFare, 0);
  const pixKey = ride?.driver_pix_account ?? null;

  useEffect(() => {
    if (!token || !ride?.id || (ride.net_fare != null && ride.net_fare > 0)) return;
    const today = new Date().toISOString().slice(0, 10);
    let cancelled = false;
    getDriverEarnings(token, { start: today, end: today })
      .then((earnings) => {
        if (cancelled) return;
        const entry = earnings.history.find((item) => item.id === ride.id);
        if (entry?.amount_cents != null && entry.amount_cents > 0) {
          setCreditedNetFare(entry.amount_cents / 100);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, ride?.id, ride?.net_fare]);

  const pixCode = paymentMethod === 'pix' && pixKey && grossFare > 0
    ? buildPixCode(pixKey, grossFare, 'SUWAVE')
    : null;

  const qrUrl = pixCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixCode)}`
    : null;

  async function handleSharePix() {
    if (!pixCode) return;
    try {
      await Share.share({ message: pixCode, title: 'Código PIX' });
    } catch {
      Alert.alert('Não foi possível compartilhar o código PIX.');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  function handleFinish() {
    router.replace('/ride-driver-rating');
  }

  const grossFmtd = formatCurrency(grossFare);
  const netFmtd = formatCurrency(netFare);
  const feeFmtd = formatCurrency(platformFee);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Receber pagamento</Text>
          <Text style={styles.method}>
            {clientPayment === 'wallet' ? '💳 Carteira Suwave'
              : clientPayment === 'pix' ? '📱 PIX Suwave'
              : rawPayment === 'pix' ? '📱 PIX'
              : '💵 Dinheiro'}
          </Text>
        </View>

        <View style={styles.fareBox}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Valor da corrida</Text>
            <Text style={styles.fareValue}>{grossFmtd}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Taxa da plataforma</Text>
            <Text style={styles.fareFee}>- {feeFmtd}</Text>
          </View>
          <View style={[styles.fareRow, styles.fareRowTotal]}>
            <Text style={styles.fareTotalLabel}>Seu líquido</Text>
            <Text style={styles.fareTotalValue}>{netFmtd}</Text>
          </View>
        </View>

        {paymentMethod === 'wallet' ? (
          <View style={styles.walletSection}>
            <Feather color="#15803d" name="credit-card" size={48} />
            <Text style={styles.walletInstruction}>
              Pagamento confirmado pela Carteira Suwave.
            </Text>
            <Text style={styles.walletNote}>
              Seu líquido estimado é <Text style={styles.walletNetBold}>{netFmtd}</Text>. Continue para avaliar o cliente.
            </Text>
          </View>
        ) : paymentMethod === 'pix' ? (
          <View style={styles.pixSection}>
            {qrUrl ? (
              <>
                <Text style={styles.pixInstruction}>
                  Mostre o QR Code para o passageiro escanear ou compartilhe o código PIX.
                </Text>
                <Image
                  contentFit="contain"
                  source={{ uri: qrUrl }}
                  style={styles.qrImage}
                />
              </>
            ) : (
              <View style={styles.pixKeyBox}>
                <Feather color="#6366f1" name="alert-circle" size={20} />
                <Text style={styles.pixKeyText}>
                  {pixKey
                    ? `Chave PIX: ${pixKey}`
                    : 'Chave PIX não cadastrada. Vá ao perfil e cadastre sua chave PIX.'}
                </Text>
              </View>
            )}
            {pixCode ? (
              <TouchableOpacity onPress={handleSharePix} style={styles.copyButton}>
                <Feather color="#fff" name={copied ? 'check' : 'share-2'} size={16} />
                <Text style={styles.copyButtonText}>
                  {copied ? 'Código compartilhado!' : 'Compartilhar código PIX'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.cashSection}>
            <Feather color="#16a34a" name="dollar-sign" size={48} />
            <Text style={styles.cashInstruction}>
              Receba {grossFmtd} em dinheiro do passageiro.
            </Text>
            <Text style={styles.cashNote}>
              O seu líquido após a taxa é <Text style={styles.cashNetBold}>{netFmtd}</Text>.
            </Text>
          </View>
        )}

        <ActionButton iconDirection="left" onPress={handleFinish}>
          {paymentMethod === 'wallet' ? 'Continuar para avaliação' : 'Confirmar recebimento'}
        </ActionButton>
        <ActionButton iconDirection="none" onPress={handleFinish} secondary>
          Pular e finalizar
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
    paddingHorizontal: SuwaveSpacing.screenHorizontal,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
    gap: 16,
  },
  headerRow: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: SuwaveTypography.heroTitleFontSize,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
  },
  method: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366f1',
  },
  fareBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    padding: 18,
    gap: 10,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 14,
    color: SuwaveColors.muted,
    fontWeight: '500',
  },
  fareValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SuwaveColors.ink,
  },
  fareFee: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e53e3e',
  },
  fareRowTotal: {
    borderTopWidth: 1,
    borderTopColor: SuwaveColors.line,
    paddingTop: 10,
    marginTop: 4,
  },
  fareTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: SuwaveColors.ink,
  },
  fareTotalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16a34a',
  },
  pixSection: {
    alignItems: 'center',
    gap: 14,
  },
  walletSection: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 28,
  },
  walletInstruction: {
    fontSize: 20,
    fontWeight: '800',
    color: '#15803d',
    textAlign: 'center',
  },
  walletNote: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  walletNetBold: {
    fontWeight: '800',
    color: '#15803d',
  },
  pixInstruction: {
    fontSize: 14,
    color: SuwaveColors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  qrImage: {
    width: 240,
    height: 240,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  pixKeyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 14,
    width: '100%',
  },
  pixKeyText: {
    flex: 1,
    fontSize: 14,
    color: '#3730a3',
    fontWeight: '600',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cashSection: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 28,
  },
  cashInstruction: {
    fontSize: 20,
    fontWeight: '800',
    color: '#15803d',
    textAlign: 'center',
  },
  cashNote: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  cashNetBold: {
    fontWeight: '800',
    color: '#15803d',
  },
});
