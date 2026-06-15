import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SuwaveColors } from '@/constants/suwave-theme';

type RadioOption = {
  label: string;
  value: string;
};

type RadioGroupFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
};

/**
 * Equivalente nativo de `.radio-field` / `RadioGroupField` em
 * app/motorista/src/app/page.tsx (selecao de sexo no cadastro).
 */
export function RadioGroupField({ label, value, onChange, options }: RadioGroupFieldProps) {
  return (
    <View>
      <Text style={styles.legend}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected && styles.optionSelected]}>
              <View style={[styles.dot, selected && styles.dotSelected]}>
                {selected ? <View style={styles.dotInner} /> : null}
              </View>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    fontSize: 14,
    fontWeight: '800',
    color: '#435160',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: SuwaveColors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  optionSelected: {
    backgroundColor: '#eefaf3',
    borderColor: '#94d4af',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9fb0bf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSelected: {
    borderColor: SuwaveColors.greenDark,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SuwaveColors.greenDark,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: SuwaveColors.ink,
    flexShrink: 1,
  },
  optionLabelSelected: {
    color: SuwaveColors.greenDark,
  },
});
