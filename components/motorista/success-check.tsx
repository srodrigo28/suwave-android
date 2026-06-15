import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { SuwaveColors } from '@/constants/suwave-theme';

type SuccessCheckProps = {
  name?: keyof typeof Feather.glyphMap;
};

/**
 * Equivalente nativo de `.success-check` em
 * app/motorista/src/app/globals.css (circulo com borda amarela e icone).
 */
export function SuccessCheck({ name = 'check' }: SuccessCheckProps) {
  return (
    <View style={styles.circle}>
      <Feather color={SuwaveColors.black} name={name} size={48} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 6,
    borderColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 26,
  },
});
