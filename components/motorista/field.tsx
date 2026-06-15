import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardTypeOptions, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SuwaveColors, SuwaveRadii, SuwaveTypography } from '@/constants/suwave-theme';

type FieldProps = {
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
 * (variante usada em login/recuperacao de senha, sem icone a esquerda).
 */
export function Field({
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType,
  maxLength,
  editable = true,
}: FieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={[styles.field, !editable && styles.fieldDisabled]}>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SuwaveColors.placeholder}
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
          <Feather color={SuwaveColors.black} name={isVisible ? 'eye-off' : 'eye'} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderWidth: 1.5,
    borderColor: SuwaveColors.inputBorder,
    borderRadius: SuwaveRadii.field,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingLeft: 22,
    marginTop: 14,
    gap: 10,
  },
  fieldDisabled: {
    backgroundColor: '#f4f4f4',
    borderColor: '#e1e1e1',
    opacity: 0.72,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: SuwaveTypography.fieldFontSize,
    color: SuwaveColors.inputText,
    paddingVertical: 0,
  },
  eyeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
