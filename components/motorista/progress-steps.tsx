import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { SuwaveColors } from '@/constants/suwave-theme';

type ProgressStepsProps = {
  total: string[];
  current: number;
  labels?: string[];
};

/**
 * Equivalente nativo de `.progress` / `Progress` em
 * app/motorista/src/app/page.tsx (indicador de etapas do cadastro).
 */
export function ProgressSteps({ total, current, labels }: ProgressStepsProps) {
  return (
    <View style={styles.row}>
      {total.map((step, index) => {
        const done = index + 1 < current;
        const active = index + 1 === current;

        return (
          <View key={step} style={styles.item}>
            <View style={[styles.circle, (done || active) && styles.circleActive]}>
              {done ? (
                <Feather color={SuwaveColors.black} name="check" size={16} />
              ) : (
                <Text style={[styles.label, (done || active) && styles.labelActive]}>{step}</Text>
              )}
            </View>
            {labels ? <Text style={styles.itemLabel}>{labels[index]}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    marginHorizontal: 8,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SuwaveColors.muted,
    textAlign: 'center',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#c9d5de',
    backgroundColor: '#f5f8fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    borderColor: 'transparent',
    backgroundColor: SuwaveColors.yellow,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: SuwaveColors.ink,
  },
  labelActive: {
    fontWeight: '900',
    color: SuwaveColors.black,
  },
});
