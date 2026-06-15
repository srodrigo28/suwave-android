import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SuwaveColors, SuwaveRadii, SuwaveTypography } from '@/constants/suwave-theme';

type SelectOption = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
};

type SelectFieldProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
};

/**
 * Equivalente nativo de `.select-field` / `SelectField` em
 * app/motorista/src/app/page.tsx (selecao do tipo de chave Pix).
 */
export function SelectField({ icon, label, value, onChange, options }: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <View>
      <Pressable onPress={() => setIsOpen((open) => !open)} style={styles.field}>
        <View style={styles.icon}>
          <Feather color={SuwaveColors.ink} name={icon} size={20} />
        </View>
        <Text style={[styles.trigger, selectedOption && styles.triggerSelected]}>
          {selectedOption?.label ?? label}
        </Text>
        <Feather color="#526475" name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {isOpen ? (
        <View style={styles.content}>
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={[styles.option, selected && styles.optionSelected]}>
                <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                  <Feather color={selected ? SuwaveColors.greenDark : SuwaveColors.ink} name={option.icon} size={18} />
                </View>
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                {selected ? <Feather color={SuwaveColors.greenDark} name="check" size={18} /> : null}
              </Pressable>
            );
          })}
        </View>
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
  icon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trigger: {
    flex: 1,
    fontSize: SuwaveTypography.fieldFontSize,
    color: '#7f8d9d',
  },
  triggerSelected: {
    color: SuwaveColors.ink,
  },
  content: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e3ea',
    borderRadius: 10,
    marginTop: 6,
    paddingVertical: 6,
    gap: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: '#eefaf3',
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce7ed',
    backgroundColor: '#f4f8fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: {
    backgroundColor: '#fff',
    borderColor: '#b7dcc8',
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: SuwaveColors.ink,
  },
  optionLabelSelected: {
    color: SuwaveColors.greenDark,
  },
});
