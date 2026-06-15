import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { SuwaveColors, SuwaveRadii, SuwaveTypography } from '@/constants/suwave-theme';

type ActionButtonProps = {
  children: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
  iconDirection?: 'left' | 'right' | 'none';
};

/**
 * Equivalente nativo de `.action` / `ActionButton` em app/motorista/src/app/page.tsx.
 * Botao principal (amarelho) e secundario (branco com borda preta).
 */
export function ActionButton({
  children,
  onPress,
  disabled = false,
  loading = false,
  secondary = false,
  iconDirection = 'right',
}: ActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        secondary ? styles.secondary : styles.primary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}>
      {iconDirection === 'left' ? (
        <Feather
          color={secondary ? SuwaveColors.black : SuwaveColors.black}
          name="arrow-left"
          size={20}
          style={styles.iconLeft}
        />
      ) : (
        <View style={styles.iconLeft} />
      )}
      {loading ? (
        <ActivityIndicator color={SuwaveColors.black} />
      ) : (
        <Text style={[styles.label, secondary && styles.labelSecondary]}>{children}</Text>
      )}
      {iconDirection === 'right' ? (
        <Feather
          color={secondary ? SuwaveColors.black : SuwaveColors.black}
          name="arrow-right"
          size={20}
          style={styles.iconRight}
        />
      ) : (
        <View style={styles.iconRight} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 58,
    borderRadius: SuwaveRadii.action,
    paddingHorizontal: 16,
    marginTop: 8,
    width: '100%',
  },
  primary: {
    backgroundColor: SuwaveColors.yellow,
    borderWidth: 1,
    borderColor: SuwaveColors.yellow,
  },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1.8,
    borderColor: SuwaveColors.secondaryActionBorder,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: SuwaveTypography.actionFontSize,
    fontWeight: '900',
    color: SuwaveColors.black,
  },
  labelSecondary: {
    fontSize: SuwaveTypography.actionSecondaryFontSize,
  },
  iconLeft: {
    width: 20,
  },
  iconRight: {
    width: 20,
  },
});
