import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardTypeOptions, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SuwaveColors, SuwaveRadii, SuwaveTypography } from '@/constants/suwave-theme';

type LabeledFieldProps = {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  editable?: boolean;
};

/**
 * Equivalente nativo de `.field` / `Field` em app/motorista/src/app/page.tsx
 * (variante usada no cadastro, com icone a esquerda).
 */
export function LabeledField({
  icon,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType,
  maxLength,
  editable = true,
}: LabeledFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={[styles.field, !editable && styles.fieldDisabled]}>
      <View style={styles.icon}>
        <Feather color={editable ? SuwaveColors.ink : '#9a9a9a'} name={icon} size={20} />
      </View>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7f8d9d"
        secureTextEntry={secure && !isVisible}
        style={styles.input}
        value={value}
      />
      {secure ? (
        <Pressable
          accessibilityLabel={isVisible ? 'Ocultar senha' : 'Mostrar senha'}
          accessibilityRole="button"
          onPress={() => setIsVisible((visible) => !visible)}
          style={styles.eyeButton}>
          <Feather color="#526475" name={isVisible ? 'eye-off' : 'eye'} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: SuwaveColors.line,
    borderRadius: SuwaveRadii.field,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    gap: 12,
  },
  fieldDisabled: {
    backgroundColor: '#f4f4f4',
    borderColor: '#e1e1e1',
    opacity: 0.72,
  },
  icon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: SuwaveTypography.fieldFontSize,
    color: SuwaveColors.ink,
    paddingVertical: 0,
  },
  eyeButton: {
    width: 26,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
