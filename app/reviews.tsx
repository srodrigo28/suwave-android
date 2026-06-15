import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { getDriverProfile } from '@/services/driver-client';

/**
 * Equivalente nativo da tela `reviews` (`ReviewsScreen`) em
 * app/motorista/src/app/page.tsx:5420-5507.
 *
 * Nota: lista de comentarios individuais nao existe no backend; o card
 * "Comentários em breve" é sempre exibido (igual à versão web).
 */
export default function ReviewsScreen() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingAverage, setRatingAverage] = useState(0);

  const ratingLabel = ratingCount > 0 ? ratingAverage.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '--';
  const completedLabel = ratingCount === 1 ? '1 avaliação recebida' : `${ratingCount} avaliações recebidas`;

  const loadReviewsProfile = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    getDriverProfile(token)
      .then((profile) => {
        setRatingAverage(profile.rating_average ?? 0);
        setRatingCount(profile.rating_count ?? 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar avaliações.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    loadReviewsProfile();
  }, [loadReviewsProfile]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
            <Feather color="#071a36" name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.title}>Avaliações</Text>
          <Pressable accessibilityLabel="Atualizar avaliações" onPress={loadReviewsProfile} style={styles.headerButton}>
            <Feather color="#071a36" name="refresh-cw" size={22} />
          </Pressable>
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreRingValue}>{ratingLabel}</Text>
            <Text style={styles.scoreRingLabel}>nota</Text>
          </View>
          <View style={styles.scoreCopy}>
            <Text style={styles.stars}>★★★★★</Text>
            <Text style={styles.scoreTitle}>{ratingCount > 0 ? 'Sua reputação está ativa' : 'Reputação em construção'}</Text>
            <Text style={styles.scoreText}>
              {ratingCount > 0
                ? completedLabel
                : 'As avaliações dos passageiros e clientes aparecerão aqui depois das primeiras corridas e entregas concluídas.'}
            </Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Média</Text>
            <Text style={styles.metricValue}>{ratingLabel}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total</Text>
            <Text style={styles.metricValue}>{ratingCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Status</Text>
            <Text style={styles.metricValue}>{ratingCount > 0 ? 'Ativa' : 'Inicial'}</Text>
          </View>
        </View>

        <FormToast message={error} />

        {isLoading ? (
          <View style={{ gap: 12 }}>
            <SkeletonBox height={100} borderRadius={14} />
            <SkeletonBox height={18} width="50%" />
            <SkeletonBox height={14} width="70%" />
          </View>
        ) : null}

        {!isLoading ? (
          <View style={styles.emptyCard}>
            <Feather color="#25c684" name="check-circle" size={34} />
            <Text style={styles.emptyCardTitle}>Comentários em breve</Text>
            <Text style={styles.emptyCardText}>
              Quando uma corrida ou entrega for avaliada, os comentários e notas individuais serão listados nesta tela.
            </Text>
          </View>
        ) : null}
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
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 1,
  },
  scoreRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    borderColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingValue: {
    fontSize: 24,
    fontWeight: '900',
    color: SuwaveColors.ink,
  },
  scoreRingLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  scoreCopy: {
    flex: 1,
    gap: 4,
  },
  stars: {
    fontSize: 18,
    color: SuwaveColors.yellow,
    letterSpacing: 2,
  },
  scoreTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#071a36',
  },
  scoreText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#667f90',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
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
  metricLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#071a36',
  },
  empty: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667f90',
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 1,
  },
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#073449',
    textAlign: 'center',
  },
  emptyCardText: {
    fontSize: 14,
    lineHeight: 19,
    color: '#667f90',
    textAlign: 'center',
    maxWidth: 310,
  },
});
