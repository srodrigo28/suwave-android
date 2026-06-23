import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors, SuwaveSpacing, SuwaveTypography } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { rateDriverRide } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

export default function RideDriverRatingScreen() {
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.activeRide);
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const passengerName = ride?.passenger_name ?? 'Passageiro';

  async function handleSubmit() {
    if (stars === 0) {
      setMessage('Selecione uma nota de 1 a 5 estrelas.');
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      if (token && ride?.id) {
        await rateDriverRide(token, ride.id, stars, comment.trim() || undefined);
      }
    } catch {
      // erro silencioso — avaliação falhou mas não bloqueamos o fluxo
    } finally {
      setActiveRide(null);
      router.replace('/dashboard');
    }
  }

  function handleSkip() {
    setActiveRide(null);
    router.replace('/dashboard');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Feather color="#ffc61a" name="star" size={48} />
        </View>

        <Text style={styles.title}>Como foi o passageiro?</Text>
        <Text style={styles.subtitle}>{passengerName}</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setStars(n)} style={styles.starBtn}>
              <Feather
                color={n <= stars ? '#ffc61a' : '#d1d5db'}
                name="star"
                size={40}
              />
            </TouchableOpacity>
          ))}
        </View>

        {stars > 0 ? (
          <Text style={styles.ratingLabel}>
            {stars === 1 && 'Muito ruim'}
            {stars === 2 && 'Ruim'}
            {stars === 3 && 'Regular'}
            {stars === 4 && 'Bom'}
            {stars === 5 && 'Excelente!'}
          </Text>
        ) : (
          <Text style={styles.ratingPlaceholder}>Toque nas estrelas para avaliar</Text>
        )}

        <TextInput
          multiline
          maxLength={200}
          numberOfLines={3}
          onChangeText={setComment}
          placeholder="Comentário opcional…"
          placeholderTextColor="#9ca3af"
          style={styles.commentInput}
          value={comment}
        />

        <FormToast message={message} />

        <ActionButton disabled={isBusy || stars === 0} loading={isBusy} onPress={handleSubmit}>
          Enviar avaliação
        </ActionButton>
        <ActionButton iconDirection="none" onPress={handleSkip} secondary>
          Pular avaliação
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SuwaveColors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: SuwaveSpacing.screenHorizontal,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
    gap: 16,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fffbeb',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: SuwaveTypography.heroTitleFontSize,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SuwaveColors.muted,
    textAlign: 'center',
  },
  starsRow: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  starBtn: { padding: 4 },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffc61a',
    textAlign: 'center',
  },
  ratingPlaceholder: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  commentInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: SuwaveColors.ink,
    textAlignVertical: 'top',
    minHeight: 80,
  },
});
