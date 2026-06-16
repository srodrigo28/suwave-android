import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet } from 'react-native';

import { SuwaveAssets } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';

/**
 * Equivalente nativo do componente `Splash` em
 * app/motorista/src/app/page.tsx (`.splash` / `.splash-image`).
 *
 * Mostra `splash.png` em tela cheia por ~1.95s e depois faz fade-out
 * (0.36s, igual a `@keyframes splashOut` no CSS) antes de ir para o login.
 */
export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(1)).current;
  const { token, isRestoring } = useAuth();

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 360,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }, 1950);

    return () => clearTimeout(fadeTimer);
  }, [opacity]);

  useEffect(() => {
    if (isRestoring) return;

    const navigateTimer = setTimeout(() => {
      router.replace(token ? '/dashboard' : '/login');
    }, 2310);

    return () => clearTimeout(navigateTimer);
  }, [token, isRestoring]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Image resizeMode="cover" source={SuwaveAssets.splash} style={styles.image} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
