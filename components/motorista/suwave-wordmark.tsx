import { StyleSheet, Text, View } from 'react-native';

import { SuwaveColors, SuwaveTypography } from '@/constants/suwave-theme';

type SuwaveWordmarkProps = {
  subtitle?: string;
  compact?: boolean;
};

/**
 * Wordmark padrao SUWAVE (SU + W em destaque + AVE) com subtitulo opcional.
 * Equivalente nativo de app/motorista/src/app/_components/suwave-wordmark.tsx.
 */
export function SuwaveWordmark({ subtitle, compact = false }: SuwaveWordmarkProps) {
  return (
    <View
      style={[styles.wrapper, compact && styles.wrapperCompact]}
      accessibilityLabel={subtitle ? `SUWAVE ${subtitle}` : 'SUWAVE'}>
      <View style={styles.logoRow}>
        <Text style={[styles.logoText, compact && styles.logoTextCompact]}>SU</Text>
        <Text style={[styles.logoWave, compact && styles.logoTextCompact]}>W</Text>
        <Text style={[styles.logoText, compact && styles.logoTextCompact]}>AVE</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 22,
  },
  wrapperCompact: {
    marginVertical: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'Arial',
    fontSize: SuwaveTypography.wordmarkFontSize,
    fontWeight: '900',
    lineHeight: SuwaveTypography.wordmarkFontSize * 0.95,
    color: SuwaveColors.black,
  },
  logoTextCompact: {
    fontSize: SuwaveTypography.wordmarkFontSize * 0.78,
    lineHeight: SuwaveTypography.wordmarkFontSize * 0.78 * 0.95,
  },
  logoWave: {
    fontFamily: 'Arial',
    fontSize: SuwaveTypography.wordmarkFontSize,
    fontWeight: '900',
    lineHeight: SuwaveTypography.wordmarkFontSize * 0.95,
    color: SuwaveColors.yellowText,
    marginHorizontal: -1,
  },
  subtitle: {
    marginTop: 15,
    fontFamily: 'Arial',
    fontSize: SuwaveTypography.wordmarkSubFontSize,
    fontWeight: '900',
    letterSpacing: 8,
    color: SuwaveColors.black,
    textAlign: 'center',
  },
});
