import { Image, StyleSheet } from 'react-native';

import { SuwaveAssets } from '@/constants/suwave-theme';

type BrandLockupProps = {
  compact?: boolean;
};

/**
 * Equivalente nativo de `.brand-lockup` / `BrandLockup` em
 * app/motorista/src/app/page.tsx (logo inicio-logo.png).
 */
export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <Image
      resizeMode="contain"
      source={SuwaveAssets.inicioLogo}
      style={[styles.logo, compact && styles.logoCompact]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: '82%',
    maxWidth: 330,
    aspectRatio: 520 / 150,
    alignSelf: 'center',
    marginBottom: 22,
  },
  logoCompact: {
    maxWidth: 248,
    marginTop: 14,
    marginBottom: 18,
  },
});
