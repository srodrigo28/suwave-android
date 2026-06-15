import { Feather } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { ProgressSteps } from '@/components/motorista/progress-steps';
import { SuwaveAssets, SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

const primarySteps = ['1', '2', '3', '4', '5'];

/**
 * Equivalente nativo da tela `face` (`FacePhoto`) em
 * app/motorista/src/app/page.tsx:2178-2432.
 *
 * No web a câmera fica embutida na propria tela (preview + captura). No
 * nativo usamos `expo-image-picker` para abrir a câmera/galeria do sistema,
 * mantendo o mesmo layout e copy.
 */
export default function FaceScreen() {
  const faceImage = useDriverFlowStore((state) => state.faceImage);
  const setFaceImage = useDriverFlowStore((state) => state.setFaceImage);
  const [error, setError] = useState('');

  async function openCamera() {
    setError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Permita o acesso à câmera para tirar a foto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      mediaTypes: ['images'],
      quality: 0.92,
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 900 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      setFaceImage({ uri: compressed.uri, name: `rosto-motorista-${Date.now()}.jpg`, type: 'image/jpeg', size: 0 });
    }
  }

  async function openGallery() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permita o acesso às fotos para escolher uma imagem.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.92,
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 900 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      setFaceImage({ uri: compressed.uri, name: `rosto-motorista-${Date.now()}.jpg`, type: 'image/jpeg', size: 0 });
    }
  }

  function handleNext() {
    if (!faceImage) {
      setError('Selecione uma foto do rosto para continuar.');
      return;
    }

    setError('');
    router.push('/cnh');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
            <Feather color={SuwaveColors.black} name="arrow-left" size={18} />
          </Pressable>
          <Text style={styles.headerTitle}>Cadastro do motorista</Text>
          <View style={styles.headerButton} />
        </View>

        <ProgressSteps current={3} total={primarySteps} />

        <Text style={styles.title}>Validar foto do rosto</Text>
        <Text style={styles.subtitle}>Tire uma foto nitida do seu rosto</Text>

        <View style={styles.faceCard}>
          <Image
            resizeMode={faceImage ? 'cover' : 'contain'}
            source={faceImage ? { uri: faceImage.uri } : SuwaveAssets.faceValidationModel}
            style={styles.faceImage}
          />
          <View style={styles.faceOval} />
        </View>

        <View style={styles.tips}>
          <View style={styles.tip}>
            <Feather color="#fff" name="zap" size={16} />
            <Text style={styles.tipText}>Boa iluminação</Text>
          </View>
          <View style={styles.tip}>
            <Feather color="#fff" name="user" size={16} />
            <Text style={styles.tipText}>Rosto centralizado</Text>
          </View>
          <View style={styles.tip}>
            <Feather color="#fff" name="slash" size={16} />
            <Text style={styles.tipText}>Sem acessórios</Text>
          </View>
        </View>

        {faceImage ? (
          <View style={styles.successLine}>
            <View style={styles.successIcon}>
              <Feather color="#090909" name="check" size={14} />
            </View>
            <Text style={styles.successText}>Foto válida! Sua foto está nítida e bem enquadrada.</Text>
          </View>
        ) : null}

        <FormToast message={error} />

        {faceImage ? (
          <>
            <ActionButton onPress={handleNext}>Próximo</ActionButton>
            <View style={styles.retakeRow}>
              <Pressable onPress={openCamera} style={styles.retakeButton}>
                <Feather color={SuwaveColors.ink} name="camera" size={17} />
                <Text style={styles.retakeText}>Tirar outra</Text>
              </Pressable>
              <Pressable onPress={openGallery} style={styles.retakeButton}>
                <Feather color={SuwaveColors.ink} name="user" size={17} />
                <Text style={styles.retakeText}>Escolher outra</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <ActionButton onPress={openCamera}>Abrir câmera</ActionButton>
            <ActionButton onPress={openGallery} secondary>
              Escolher foto
            </ActionButton>
          </>
        )}

        <Text style={styles.security}>▣ Suas fotos são protegidas e usadas apenas para verificação de segurança.</Text>
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
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: SuwaveColors.black,
    backgroundColor: '#f5f8fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    color: SuwaveColors.ink,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: SuwaveColors.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  faceCard: {
    width: '100%',
    aspectRatio: 16 / 13,
    borderRadius: 22,
    backgroundColor: '#d9d9d7',
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  faceImage: {
    width: '100%',
    height: '100%',
  },
  faceOval: {
    position: 'absolute',
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.95)',
    borderRadius: 9999,
    top: '9%',
    left: '23%',
    width: '54%',
    height: '76%',
  },
  tips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    width: '100%',
  },
  tip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(6,52,73,0.72)',
  },
  tipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  successLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    backgroundColor: '#fff8df',
    borderWidth: 1,
    borderColor: '#ffd762',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  successIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SuwaveColors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: '#533f00',
    fontWeight: '700',
  },
  retakeRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 10,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: SuwaveColors.line,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  retakeText: {
    fontSize: 14,
    fontWeight: '800',
    color: SuwaveColors.ink,
  },
  security: {
    fontSize: 13,
    color: '#395873',
    textAlign: 'center',
    marginTop: 14,
  },
});
