import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { BrandLockup } from '@/components/motorista/brand-lockup';
import { FormToast } from '@/components/motorista/form-toast';
import { ReviewRing } from '@/components/motorista/review-ring';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { getDriverReviewStatus } from '@/services/driver-client';
import { formatReviewTime, reviewApprovalWindowSeconds, reviewMissingLabels } from '@/utils/review';

/**
 * Equivalente nativo da tela `status` (`Status`) em
 * app/motorista/src/app/page.tsx:2754-2853.
 */
export default function StatusScreen() {
  const { token } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(reviewApprovalWindowSeconds);
  const [statusText, setStatusText] = useState('EM_ANALISE');
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const minutesLeft = Math.ceil(secondsLeft / 60);
  const timeLeft = formatReviewTime(secondsLeft);
  const progress = Math.max(0, Math.min(1, secondsLeft / reviewApprovalWindowSeconds));

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function syncReviewStatus() {
      try {
        const status = await getDriverReviewStatus(token as string);
        if (cancelled) return;
        setStatusText(status.status);
        setSecondsLeft(status.seconds_remaining);
        setMissingFields(status.missing);
        if (status.approved) {
          router.replace('/dashboard');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível consultar o status.');
        }
      }
    }

    syncReviewStatus();
    const interval = setInterval(syncReviewStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (secondsLeft <= 0 && statusText === 'APROVADO') {
      router.replace('/dashboard');
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft, statusText]);

  const toastMessage =
    error ||
    (missingFields.length
      ? `Pendências: ${missingFields.map((field) => reviewMissingLabels[field] ?? field).join(', ')}.`
      : '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <BrandLockup />

        <ReviewRing minutesLeft={minutesLeft} progress={progress} />

        <Text style={styles.title}>Cadastro em análise</Text>

        <Text style={styles.reviewTime}>
          Faltam <Text style={styles.reviewTimeStrong}>{timeLeft}</Text> para liberar
        </Text>

        <Text style={styles.subtitle}>
          Estamos verificando seus dados. A liberação automática segue a regra de 10 minutos.
        </Text>

        <FormToast message={toastMessage} />

        <View style={styles.checklist}>
          <ChecklistRow done first label="Telefone confirmado" />
          <ChecklistRow done label="Foto recebida" />
          <ChecklistRow done label="CNH enviada" />
          <ChecklistRow label="Veículo pode ser completado depois" />
        </View>

        <ActionButton onPress={() => router.replace('/dashboard')}>Aguardo aprovação</ActionButton>
        <ActionButton onPress={() => router.push('/submitted')} secondary>
          Ver meus dados
        </ActionButton>
      </View>
    </SafeAreaView>
  );
}

function ChecklistRow({ done = false, first = false, label }: { done?: boolean; first?: boolean; label: string }) {
  return (
    <View style={[styles.checklistRow, first && styles.checklistRowFirst]}>
      <Text style={styles.checklistMark}>{done ? '✓' : '○'}</Text>
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
    paddingHorizontal: SuwaveSpacing.screenHorizontal,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 14,
  },
  reviewTime: {
    fontSize: 20,
    fontWeight: '800',
    color: SuwaveColors.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  reviewTimeStrong: {
    fontSize: 24,
    fontWeight: '900',
    color: SuwaveColors.yellow,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 23,
    color: SuwaveColors.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
  checklist: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8edf1',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginVertical: 22,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: SuwaveColors.line,
  },
  checklistRowFirst: {
    borderTopWidth: 0,
  },
  checklistMark: {
    fontSize: 16,
    fontWeight: '700',
    color: SuwaveColors.yellow,
    width: 18,
    textAlign: 'center',
  },
  checklistLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#243949',
    lineHeight: 23,
  },
});
