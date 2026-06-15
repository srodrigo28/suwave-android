import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLockup } from '@/components/motorista/brand-lockup';

type AppHeaderProps = {
  onBack: () => void;
};

/**
 * Equivalente nativo de `.app-header` / `AppHeader` em
 * app/motorista/src/app/page.tsx:6429-6439.
 */
export function AppHeader({ onBack }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Voltar" onPress={onBack} style={styles.button}>
        <Feather color="#253746" name="arrow-left" size={22} />
      </Pressable>
      <BrandLockup compact />
      <Pressable accessibilityLabel="Perfil do motorista" style={styles.button}>
        <Text style={styles.profileIcon}>♙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  button: {
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
  profileIcon: {
    fontSize: 21,
    color: '#3c4a55',
  },
});
