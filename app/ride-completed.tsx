import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { Confetti } from '@/components/motorista/confetti';
import { FormToast } from '@/components/motorista/form-toast';
import { SuccessCheck } from '@/components/motorista/success-check';
import { SuwaveWordmark } from '@/components/motorista/suwave-wordmark';
import { SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { rateDriverRide } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

const STAR_COUNT = 5;

export default function RideCompletedScreen() {
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.activeRide);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');

  async function handleSubmitRating() {
    if (!token || !ride || rating === 0) return;
    setIsSubmitting(true);
    setRatingError('');
    try {
      await rateDriverRide(token, ride.id, rating, comment.trim() || undefined);
      setSubmitted(true);
    } catch {
      setRatingError('Não foi possível enviar a avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFinish() {
    router.replace('/dashboard');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Confetti />
      <ScrollView contentContainerStyle={styles.content}>
        <SuwaveWordmark subtitle="MOTORISTA" />

        <SuccessCheck />

        <Text style={styles.title}>Corrida concluída!</Text>
        <Text style={styles.copy}>
          {ride?.destination_label ? `Destino: ${ride.destination_label}. ` : ''}
          Obrigado por completar a corrida com segurança.
        </Text>

        <View style={styles.successBox}>
          <Feather color="#f2b100" name="zap" size={32} style={styles.successIcon} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Ganhos registrados</Text>
            <Text style={styles.successText}>O valor será creditado no seu saldo em breve.</Text>
          </View>
        </View>

        {!submitted ? (
          <View style={styles.ratingBox}>
            <Text style={styles.ratingTitle}>Como foi o passageiro?</Text>
            <Text style={styles.ratingSubtitle}>Sua avaliação é anônima para ele.</Text>

            <View style={styles.starsRow}>
              {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => (
                <Pressable key={star} onPress={() => setRating(star)} style={styles.starBtn}>
                  <Feather
                    color={star <= rating ? '#f2b100' : SuwaveColors.line}
                    name="star"
                    size={36}
                  />
                </Pressable>
              ))}
            </View>

            {rating > 0 && (
              <TextInput
                maxLength={300}
                multiline
                onChangeText={setComment}
                placeholder="Comentário opcional..."
                placeholderTextColor={SuwaveColors.muted}
                style={styles.commentInput}
                value={comment}
              />
            )}

            {ratingError ? <FormToast message={ratingError} /> : null}

            {rating > 0 && (
              <ActionButton
                disabled={isSubmitting}
                iconDirection="left"
                loading={isSubmitting}
                onPress={handleSubmitRating}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar avaliação'}
              </ActionButton>
            )}

            <ActionButton iconDirection="none" onPress={handleFinish} secondary>
              {rating === 0 ? 'Pular avaliação' : 'Depois'}
            </ActionButton>
          </View>
        ) : (
          <>
            <View style={styles.ratedBox}>
              <Feather color="#16a34a" name="check-circle" size={22} />
              <Text style={styles.ratedText}>Avaliação enviada! Obrigado.</Text>
            </View>
            <ActionButton iconDirection="left" onPress={handleFinish}>
              Voltar ao início
            </ActionButton>
          </>
        )}
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
    justifyContent: 'center',
    paddingHorizontal: SuwaveSpacing.screenHorizontal,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
    gap: 16,
  },
  title: {
    fontSize: SuwaveTypography.heroTitleFontSize,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
  },
  copy: {
    fontSize: SuwaveTypography.heroTextFontSize,
    fontWeight: '600',
    color: SuwaveColors.muted,
    textAlign: 'center',
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
  ratingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    padding: 20,
    gap: 12,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: SuwaveColors.ink,
  },
  ratingSubtitle: {
    fontSize: 13,
    color: SuwaveColors.muted,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  starBtn: {
    padding: 4,
  },
  commentInput: {
    width: '100%',
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    backgroundColor: SuwaveColors.background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: SuwaveColors.ink,
    textAlignVertical: 'top',
  },
  ratedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
  },
  ratedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803d',
  },
});
