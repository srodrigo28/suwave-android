import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { ProgressSteps } from '@/components/motorista/progress-steps';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { VehicleBrandOption, useDriverFlowStore } from '@/stores/driver-flow-store';
import { fallbackBrands, getBrandInitials, normalizeBrandName, vehicleSteps } from '@/utils/vehicles';

/**
 * Equivalente nativo da tela `vehicle-brand` (`VehicleBrand`) em
 * app/motorista/src/app/page.tsx:6283-6427.
 *
 * Simplificacoes desta primeira versao:
 * - Logos das marcas (CDN simpleicons) substituidos por circulo com
 *   iniciais (`getBrandInitials`), sem chamada externa de imagem.
 */
export default function VehicleBrandScreen() {
  const selectedBrand = useDriverFlowStore((state) => state.selectedBrand);
  const setSelectedBrand = useDriverFlowStore((state) => state.setSelectedBrand);

  const [brands, setBrands] = useState<VehicleBrandOption[]>(fallbackBrands);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [brandLoadError, setBrandLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBrands() {
      try {
        const response = await fetch('https://brasilapi.com.br/api/fipe/marcas/v1/carros');

        if (!response.ok) {
          throw new Error('Nao foi possivel carregar marcas');
        }

        const data = (await response.json()) as { nome?: string; valor?: string }[];
        const nextBrands = data
          .filter((brand) => brand.nome && brand.valor)
          .map((brand) => ({ codigo: String(brand.valor), nome: String(brand.nome) }))
          .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'));

        if (isMounted && nextBrands.length > 0) {
          setBrands(nextBrands);
          setBrandLoadError(false);
        }
      } catch {
        if (isMounted) {
          setBrands(fallbackBrands);
          setBrandLoadError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingBrands(false);
        }
      }
    }

    loadBrands();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBrands = brands.filter((brand) => normalizeBrandName(brand.nome).includes(normalizeBrandName(query)));
  const visibleBrands = filteredBrands.slice(0, 36);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Cadastrar veículo</Text>
        </View>

        <ProgressSteps current={1} total={vehicleSteps} />

        <Text style={styles.sectionTitle}>Informações do veículo</Text>

        <View style={styles.art}>
          <Feather color="#0f2c3f" name="truck" size={48} />
        </View>

        <Text style={styles.subtitle}>Vamos começar! Selecione o fabricante do seu veículo.</Text>

        <View style={styles.panel}>
          <Text style={styles.label}>Fabricante</Text>
          <Pressable
            accessibilityState={{ expanded: isOpen }}
            onPress={() => setIsOpen((current) => !current)}
            style={styles.trigger}>
            <Text style={styles.triggerText}>{selectedBrand?.nome ?? 'Selecione o fabricante'}</Text>
            <Feather color={SuwaveColors.ink} name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} />
          </Pressable>

          {isOpen ? (
            <View style={styles.dropdown}>
              <TextInput
                onChangeText={setQuery}
                placeholder="Buscar fabricante"
                placeholderTextColor="#7f8d9d"
                style={styles.searchInput}
                value={query}
              />
              <ScrollView style={styles.brandList}>
                {isLoadingBrands ? <Text style={styles.brandMessage}>Carregando marcas da FIPE...</Text> : null}
                {!isLoadingBrands && visibleBrands.length === 0 ? (
                  <Text style={styles.brandMessage}>Nenhuma marca encontrada.</Text>
                ) : null}
                {!isLoadingBrands && brandLoadError ? (
                  <Text style={styles.brandMessageMuted}>Usando lista local até a API responder.</Text>
                ) : null}
                {visibleBrands.map((brand) => {
                  const active = selectedBrand?.codigo === brand.codigo;

                  return (
                    <Pressable
                      key={brand.codigo}
                      onPress={() => {
                        setSelectedBrand(brand);
                        setQuery('');
                        setIsOpen(false);
                      }}
                      style={[styles.brandRow, active && styles.brandRowActive]}>
                      <View style={styles.brandLogo}>
                        <Text style={styles.brandLogoText}>{getBrandInitials(brand.nome)}</Text>
                      </View>
                      <Text style={[styles.brandRowText, active && styles.brandRowTextActive]}>{brand.nome}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <ActionButton onPress={() => router.push('/vehicle-data')}>Continuar</ActionButton>
        <ActionButton iconDirection="left" onPress={() => router.replace('/vehicle-mode')} secondary>
          Voltar
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SuwaveColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
  },
  titleRow: {
    marginBottom: 4,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: SuwaveColors.ink,
    lineHeight: 38,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: SuwaveColors.ink,
    marginTop: 12,
    marginBottom: 8,
  },
  art: {
    height: 150,
    borderRadius: 16,
    backgroundColor: '#f6fafb',
    borderWidth: 1,
    borderColor: '#dce8ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 23,
    color: SuwaveColors.muted,
    textAlign: 'left',
    marginBottom: 12,
  },
  panel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 9,
    gap: 12,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#0c2a3a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 2,
  },
  label: {
    fontSize: 19,
    fontWeight: '800',
    color: SuwaveColors.ink,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    borderWidth: 2,
    borderColor: SuwaveColors.ink,
    borderRadius: 8,
    paddingHorizontal: 18,
  },
  triggerText: {
    fontSize: 22,
    color: SuwaveColors.ink,
  },
  dropdown: {
    borderTopWidth: 1,
    borderTopColor: SuwaveColors.line,
    paddingTop: 12,
    gap: 12,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: SuwaveColors.ink,
    borderRadius: 8,
    minHeight: 56,
    paddingHorizontal: 16,
    fontSize: 18,
    color: SuwaveColors.ink,
  },
  brandList: {
    maxHeight: 320,
  },
  brandMessage: {
    fontSize: 15,
    fontWeight: '800',
    color: SuwaveColors.ink,
    paddingVertical: 14,
  },
  brandMessageMuted: {
    fontSize: 14,
    fontWeight: '700',
    color: SuwaveColors.muted,
    backgroundColor: '#f6fafb',
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: SuwaveColors.line,
  },
  brandRowActive: {
    backgroundColor: '#eefaf3',
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#dce8ef',
    backgroundColor: '#f6fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
    fontSize: 13,
    fontWeight: '900',
    color: SuwaveColors.ink,
  },
  brandRowText: {
    fontSize: 20,
    color: SuwaveColors.ink,
    flexShrink: 1,
  },
  brandRowTextActive: {
    color: SuwaveColors.greenDark,
    fontWeight: '900',
  },
});
