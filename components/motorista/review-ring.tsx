import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { SuwaveColors } from '@/constants/suwave-theme';

type ReviewRingProps = {
  progress: number;
  minutesLeft: number;
};

const SIZE = 140;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Equivalente nativo de `.review-ring` em
 * app/motorista/src/app/page.tsx (anel de contagem da analise de cadastro).
 */
export function ReviewRing({ progress, minutesLeft }: ReviewRingProps) {
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.wrapper}>
      <Svg height={SIZE} width={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke="#edf1f4"
          strokeWidth={STROKE}
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          r={RADIUS}
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
          stroke={SuwaveColors.yellow}
          strokeDasharray={`${CIRCUMFERENCE}, ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={STROKE}
        />
      </Svg>
      <View style={styles.label}>
        <Text style={styles.minutes}>{minutesLeft}</Text>
        <Text style={styles.unit}>min</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  label: {
    position: 'absolute',
    alignItems: 'center',
  },
  minutes: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0d3f55',
    lineHeight: 32,
  },
  unit: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0d3f55',
    marginTop: 3,
  },
});
