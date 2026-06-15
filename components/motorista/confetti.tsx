import { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLORS = ['#ffc61a', '#25c684', '#3cb8f0', '#f05a5a', '#a78bfa', '#fb923c'];
const COUNT = 28;

type Piece = {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
  rotation: number;
};

function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const translateY = useSharedValue(-piece.size * 2);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      piece.delay,
      withTiming(700, { duration: 1800, easing: Easing.out(Easing.quad) }),
    );
    opacity.value = withDelay(
      piece.delay,
      withTiming(1, { duration: 100 }),
    );
  }, [opacity, piece.delay, piece.size, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${piece.rotation}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: piece.x,
          width: piece.size,
          height: piece.size * 0.5,
          backgroundColor: piece.color,
          borderRadius: piece.size * 0.1,
        },
        animatedStyle,
      ]}
    />
  );
}

export function Confetti() {
  const pieces = useMemo<Piece[]>(() => {
    return Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      x: seededRand(i * 3) * SCREEN_WIDTH,
      color: COLORS[Math.floor(seededRand(i * 7) * COLORS.length)],
      delay: seededRand(i * 11) * 800,
      size: 8 + seededRand(i * 5) * 8,
      rotation: seededRand(i * 13) * 360,
    }));
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} piece={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});
