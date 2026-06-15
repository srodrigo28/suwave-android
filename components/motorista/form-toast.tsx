import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { SuwaveColors } from '@/constants/suwave-theme';

type FormToastProps = {
  message?: string;
  tone?: 'warning' | 'success';
};

/**
 * Equivalente nativo de `.form-toast` / `FormToast` em
 * app/motorista/src/app/page.tsx. So renderiza quando ha mensagem.
 */
export function FormToast({ message, tone = 'warning' }: FormToastProps) {
  if (!message) {
    return null;
  }

  const isSuccess = tone === 'success';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.toast, isSuccess ? styles.success : styles.warning]}>
      <View style={[styles.iconCircle, isSuccess ? styles.iconCircleSuccess : styles.iconCircleWarning]}>
        {isSuccess ? (
          <Feather color="#ffffff" name="check" size={14} />
        ) : (
          <Text style={styles.iconExclamation}>!</Text>
        )}
      </View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  warning: {
    backgroundColor: '#fff7dc',
    borderColor: SuwaveColors.yellow,
  },
  success: {
    backgroundColor: '#effaf2',
    borderColor: '#74c783',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleWarning: {
    backgroundColor: SuwaveColors.yellow,
  },
  iconCircleSuccess: {
    backgroundColor: '#25a64a',
  },
  iconExclamation: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 17,
    color: SuwaveColors.black,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    color: '#171717',
  },
});
