import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti } from '@/components/motorista/confetti';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';

/**
 * Equivalente nativo da tela `submitted` (`Submitted`) em
 * app/motorista/src/app/page.tsx:2683-2729.
 */
export default function SubmittedScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Confetti />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.backButton}>
          <Feather color="#111827" name="arrow-left" size={26} />
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Cadastro enviado para análise</Text>
          <Text style={styles.heroText}>Todos os dados foram recebidos com sucesso.</Text>
          <Image resizeMode="contain" source={SuwaveAssets.submittedCar} style={styles.heroImage} />
        </View>

        <View style={styles.checklist}>
          <ChecklistItem label="Cadastro do motorista concluído" />
          <ChecklistItem label="Escolha da modalidade concluída" />
          <ChecklistItem label="CNH enviada" />
          <ChecklistItem label="Termos e Política aceitos" />
        </View>

        <View style={styles.analysisCard}>
          <Feather color={SuwaveColors.yellow} name="shield" size={40} />
          <View style={styles.analysisCopy}>
            <Text style={styles.analysisTitle}>Seu cadastro está em análise.</Text>
            <Text style={styles.analysisText}>Nossa equipe fará a avaliação e em breve entrará em contato.</Text>
          </View>
        </View>

        <Pressable onPress={() => router.replace('/login')} style={styles.homeButton}>
          <Feather color={SuwaveColors.yellow} name="home" size={20} />
          <Text style={styles.homeButtonText}>Voltar ao início</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <View style={styles.checklistItem}>
      <View style={styles.checklistIcon}>
        <Feather color="#101828" name="check" size={14} />
      </View>
      <Text style={styles.checklistText}>{label}</Text>
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
    paddingHorizontal: 18,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eef2f5',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    gap: 8,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 44,
  },
  heroText: {
    fontSize: 21,
    fontWeight: '500',
    color: '#404653',
    marginTop: 4,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 638 / 425,
    marginTop: 4,
  },
  checklist: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#edf1f3',
    borderRadius: 12,
    paddingHorizontal: 18,
    marginVertical: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: SuwaveColors.line,
  },
  checklistIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  analysisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fffdf4',
    borderWidth: 1,
    borderColor: '#ffebad',
    borderRadius: 10,
    padding: 16,
  },
  analysisCopy: {
    flex: 1,
    gap: 4,
  },
  analysisTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },
  analysisText: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    borderWidth: 2,
    borderColor: SuwaveColors.yellow,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: SuwaveColors.black,
  },
});
