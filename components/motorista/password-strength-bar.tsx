import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

type Strength = 0 | 1 | 2 | 3;

function getStrength(password: string): Strength {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9!@#$%^&*]/.test(password)) score++;
  return Math.min(score, 3) as Strength;
}

const LABELS: Record<Strength, string> = { 0: '', 1: 'Fraca', 2: 'Média', 3: 'Forte' };
const COLORS: Record<Strength, string> = { 0: '#dce6ec', 1: '#e05252', 2: '#f2a100', 3: '#25c684' };

type Props = { password: string };

export function PasswordStrengthBar({ password }: Props) {
  const strength = getStrength(password);
  const color = COLORS[strength];
  const label = LABELS[strength];

  const barStyle = useAnimatedStyle(() => ({
    width: withTiming(`${(strength / 3) * 100}%` as `${number}%`, { duration: 300 }),
    backgroundColor: withTiming(color, { duration: 300 }),
  }));

  if (password.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -4,
    marginBottom: 8,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dce6ec',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'right',
  },
});
