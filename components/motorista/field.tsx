import { Feather, FontAwesome } from '@expo/vector-icons';
import { Ref, useState } from 'react';
import { KeyboardTypeOptions, Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { SuwaveColors, SuwaveRadii, SuwaveTypography } from '@/constants/suwave-theme';

type FieldProps = Omit<TextInputProps, 'onChangeText' | 'placeholder' | 'secureTextEntry' | 'style' | 'value'> & {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Icone a esquerda — espelha a prop `icon` do `Field` web (mail/lock/whatsapp). */
  icon?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  editable?: boolean;
  inputRef?: Ref<TextInput>;
};

/**
 * Equivalente nativo de `.field` / `Field` em app/motorista/src/app/page.tsx.
 * O `Field` web sempre renderiza um icone a esquerda (`.field-icon`, cor --ink);
 * passe `icon` para reproduzir isso em login/recuperacao de senha.
 */
function FieldIcon({ name, editable }: { name: string; editable: boolean }) {
  const color = editable ? SuwaveColors.ink : '#9a9a9a';
  if (name === 'whatsapp') {
    // Feather nao tem whatsapp; usa FontAwesome para o mesmo glifo da web.
    return <FontAwesome color={color} name="whatsapp" size={20} />;
  }
  return <Feather color={color} name={name as keyof typeof Feather.glyphMap} size={20} />;
}

export function Field({
  value,
  onChangeText,
  placeholder,
  icon,
  secure = false,
  keyboardType,
  maxLength,
  editable = true,
  inputRef,
  ...inputProps
}: FieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={[styles.field, icon ? styles.fieldWithIcon : null, !editable && styles.fieldDisabled]}>
      {icon ? (
        <View style={styles.icon}>
          <FieldIcon editable={editable} name={icon} />
        </View>
      ) : null}
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SuwaveColors.placeholder}
        ref={inputRef}
        secureTextEntry={secure && !isVisible}
        style={styles.input}
        value={value}
        {...inputProps}
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
  fieldWithIcon: {
    // Com icone, alinha o padding ao LabeledField (icone + gap a esquerda).
    paddingLeft: 14,
    gap: 12,
  },
  icon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
