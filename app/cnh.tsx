import { Feather } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { ProgressSteps } from '@/components/motorista/progress-steps';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import {
  DriverApiError,
  linkDriverCredential,
  loginDriverAccount,
  linkDriverRole,
  registerDriverAccount,
  saveDriverCnh,
  saveDriverFacePhoto,
  saveDriverProfile,
  submitDriverReview,
  uploadDriverImage,
} from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { maskedDateToIso, onlyDigits } from '@/utils/masks';

const primarySteps = ['1', '2', '3', '4', '5'];

/**
 * Equivalente nativo da tela `cnh` (`Cnh`) em
 * app/motorista/src/app/page.tsx:2434-2681.
 */
export default function CnhScreen() {
  const { authenticate } = useAuth();
  const signupForm = useDriverFlowStore((state) => state.signupForm);
  const isLinkingExistingAccount = useDriverFlowStore((state) => state.isLinkingExistingAccount);
  const faceImage = useDriverFlowStore((state) => state.faceImage);
  const cnhFront = useDriverFlowStore((state) => state.cnhFront);
  const cnhBack = useDriverFlowStore((state) => state.cnhBack);
  const setCnhFront = useDriverFlowStore((state) => state.setCnhFront);
  const setCnhBack = useDriverFlowStore((state) => state.setCnhBack);
  const resetFlow = useDriverFlowStore((state) => state.resetFlow);

  const [error, setError] = useState('');
  const [submitStep, setSubmitStep] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const uploadProgress = useSharedValue(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: withTiming(`${uploadProgress.value}%` as `${number}%`, { duration: 200 }),
  }));

  async function pickImage(side: 'front' | 'back') {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permita o acesso às fotos para enviar a imagem da CNH.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.92,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
    );
    const image = { uri: compressed.uri, name: `cnh-${side}-${Date.now()}.jpg`, type: 'image/jpeg', size: 0 };

    if (side === 'front') {
      setCnhFront(image);
    } else {
      setCnhBack(image);
    }
  }

  async function handleFinish() {
    if (!faceImage) {
      setError('Envie a foto do rosto antes de finalizar.');
      return;
    }
    if (!cnhFront || !cnhBack) {
      setError('Envie frente e verso da CNH antes de finalizar.');
      return;
    }

    const birthDateIso = maskedDateToIso(signupForm.birth_date);
    const cpf = onlyDigits(signupForm.cpf);
    const cnpj = onlyDigits(signupForm.cnpj);
    const whatsapp = onlyDigits(signupForm.whatsapp);

    setIsSubmitting(true);
    setError('');
    setSubmitStep('Criando sua conta...');
    uploadProgress.value = 0;
    progressIntervalRef.current = setInterval(() => {
      uploadProgress.value = Math.min(uploadProgress.value + 3, 90);
    }, 200);
    try {
      const email = signupForm.email.trim().toLowerCase();
      let session;

      if (isLinkingExistingAccount) {
        // Comprador já existente: vincula papel de motorista com senha exclusiva
        session = await linkDriverCredential({ email, role_password: signupForm.password });
      } else {
        try {
          session = await registerDriverAccount({
            birth_date: birthDateIso || undefined,
            email,
            full_name: signupForm.full_name,
            gender: signupForm.gender,
            password: signupForm.password,
          });
          session = await linkDriverRole(session.access_token);
        } catch (err) {
          if (!(err instanceof DriverApiError) || err.code !== 'email_already_exists') {
            throw err;
          }
          // Fallback para caso de race condition: tenta login e link normal
          try {
            session = await loginDriverAccount({ email, password: signupForm.password });
            session = await linkDriverRole(session.access_token);
          } catch (loginErr) {
            if (loginErr instanceof DriverApiError && loginErr.code === 'invalid_credentials') {
              throw new Error('Este e-mail já existe em outro app SUWAVE. Para juntar as contas, informe a senha dessa conta ou recupere a senha.');
            }
            throw loginErr;
          }
        }
      }

      await authenticate(session.access_token);

      setSubmitStep('Salvando seus dados...');
      await saveDriverProfile(session.access_token, {
        birth_date: birthDateIso || undefined,
        cnpj,
        cpf,
        email,
        full_name: signupForm.full_name,
        gender: signupForm.gender,
        phone: whatsapp,
        pix_account: signupForm.pix_account.trim(),
        pix_key_type: signupForm.pix_key_type,
      });

      setSubmitStep('Enviando foto do rosto...');
      const faceUpload = await uploadDriverImage(session.access_token, faceImage, 'driver_face');
      await saveDriverFacePhoto(session.access_token, faceUpload);

      setSubmitStep('Enviando CNH...');
      const [cnhFrontUpload, cnhBackUpload] = await Promise.all([
        uploadDriverImage(session.access_token, cnhFront, 'driver_cnh'),
        uploadDriverImage(session.access_token, cnhBack, 'driver_cnh'),
      ]);
      await saveDriverCnh(session.access_token, {
        cnh_back_file_id: cnhBackUpload.storage_file_id,
        cnh_back_url: cnhBackUpload.url,
        cnh_front_file_id: cnhFrontUpload.storage_file_id,
        cnh_front_url: cnhFrontUpload.url,
      });

      setSubmitStep('Enviando para análise...');
      await submitDriverReview(session.access_token);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      uploadProgress.value = 100;
      resetFlow();
      router.replace('/submitted');
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      uploadProgress.value = 0;
      setError(err instanceof Error ? err.message : 'Não foi possível finalizar o cadastro.');
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Cadastro do motorista</Text>
        <ProgressSteps current={4} total={primarySteps} />
        <Text style={styles.title}>Enviar CNH</Text>
        <Text style={styles.subtitle}>Envie imagens nitidas do documento</Text>

        <UploadCard
          image={cnhFront}
          label="Frente da CNH"
          onPress={() => pickImage('front')}
        />
        <UploadCard
          image={cnhBack}
          label="Verso da CNH"
          onPress={() => pickImage('back')}
        />

        <View style={styles.infoLine}>
          <Feather color="#395873" name="info" size={16} />
          <Text style={styles.infoText}>Verifique se todos os dados estão legíveis</Text>
        </View>

        <FormToast message={error} />

        {isSubmitting ? (
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressBarStyle]} />
            <Text style={styles.progressLabel}>{submitStep || 'Enviando...'}</Text>
          </View>
        ) : null}

        <ActionButton disabled={isSubmitting} loading={isSubmitting} onPress={handleFinish}>
          {isSubmitting ? submitStep || 'Concluindo...' : 'Concluir cadastro'}
        </ActionButton>
        <ActionButton iconDirection="left" onPress={() => router.back()} secondary>
          Voltar
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}

type UploadCardProps = {
  label: string;
  image?: { uri: string };
  onPress: () => void;
};

function UploadCard({ label, image, onPress }: UploadCardProps) {
  return (
    <View style={styles.uploadCard}>
      <Text style={styles.uploadLabel}>{label}</Text>
      {image ? (
        <View style={styles.docPreview}>
          <Image resizeMode="cover" source={{ uri: image.uri }} style={styles.docImage} />
          <View style={styles.docStatus}>
            <Feather color="#fff" name="check" size={12} />
            <Text style={styles.docStatusText}>Selecionado</Text>
          </View>
          <Pressable onPress={onPress} style={styles.docRetake}>
            <Feather color="#fff" name="camera" size={16} />
            <Text style={styles.docRetakeText}>Trocar imagem</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onPress} style={styles.uploadButton}>
          <Feather color={SuwaveColors.black} name="camera" size={20} />
          <Text style={styles.uploadButtonText}>Enviar imagem</Text>
        </Pressable>
      )}
    </View>
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
  eyebrow: {
    fontSize: 14,
    fontWeight: '900',
    color: SuwaveColors.ink,
    marginBottom: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: SuwaveColors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  uploadLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: SuwaveColors.ink,
  },
  docPreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8e0e8',
    backgroundColor: '#edf2f7',
    overflow: 'hidden',
    position: 'relative',
  },
  docImage: {
    width: '100%',
    height: '100%',
  },
  docStatus: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8,8,8,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  docStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  docRetake: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8,8,8,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,196,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  docRetakeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SuwaveColors.yellow,
    backgroundColor: SuwaveColors.yellow,
  },
  uploadButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: SuwaveColors.black,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginVertical: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#395873',
    lineHeight: 20,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dce6ec',
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: SuwaveColors.yellow,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#607381',
    textAlign: 'center',
    marginBottom: 4,
  },
});
