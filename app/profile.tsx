import { Feather } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormToast } from '@/components/motorista/form-toast';
import { LabeledField } from '@/components/motorista/labeled-field';
import { RadioGroupField } from '@/components/motorista/radio-group-field';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { DriverProfile, DriverVehicle, getDriverProfile, saveDriverFacePhoto, updateDriverProfile, uploadDriverImage } from '@/services/driver-client';
import { maskCnpj, maskCpf, maskDate, maskPhone, onlyDigits } from '@/utils/masks';

/**
 * Equivalente nativo da tela `profile` (`DriverProfileScreen`) em
 * app/motorista/src/app/page.tsx:3440-3765.
 */

function isVehicleApproved(vehicle?: DriverVehicle) {
  return vehicle?.status?.toUpperCase() === 'APROVADO';
}

type ProfileForm = {
  birth_date: string;
  cnpj: string;
  cpf: string;
  email: string;
  full_name: string;
  gender: string;
  phone: string;
  pix_account: string;
  pix_key_type: string;
};

function fillForm(p: DriverProfile): ProfileForm {
  return {
    birth_date: p.birth_date ? maskDate(p.birth_date.replace(/-/g, '')) : '',
    cnpj: maskCnpj(p.cnpj ?? ''),
    cpf: maskCpf(p.cpf ?? ''),
    email: p.email ?? '',
    full_name: p.full_name ?? '',
    gender: p.gender ?? '',
    phone: maskPhone(p.phone ?? ''),
    pix_account: p.pix_account ?? '',
    pix_key_type: p.pix_key_type ?? '',
  };
}

export default function ProfileScreen() {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    birth_date: '', cnpj: '', cpf: '', email: '',
    full_name: '', gender: '', phone: '', pix_account: '', pix_key_type: '',
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const vehicle = profile?.vehicles?.[0];
  const facePhotoUrl = profile?.face_photo_url ?? profile?.documents?.face_photo_url;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getDriverProfile(token).then((p) => {
      if (cancelled) return;
      setProfile(p);
      setForm(fillForm(p));
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar seu perfil.');
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [token]);

  function handleRefresh() {
    if (!token) return;
    getDriverProfile(token).then((p) => {
      setProfile(p);
      setForm(fillForm(p));
      setSuccess('Dados atualizados.');
    }).catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível atualizar seus dados.'));
  }

  async function handleChangePhoto() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permita o acesso às fotos para trocar sua foto de perfil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.92 });
    if (result.canceled || !result.assets[0]) return;

    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 900 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );

    if (!token) return;
    setIsUploadingPhoto(true);
    try {
      const uploaded = await uploadDriverImage(token, {
        uri: compressed.uri,
        name: `foto-perfil-${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: 0,
      }, 'driver_face');
      await saveDriverFacePhoto(token, uploaded);
      const updated = await getDriverProfile(token);
      setProfile(updated);
      setSuccess('Foto de perfil atualizada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!token) return;
    if (!form.full_name.trim()) { setError('Informe seu nome completo.'); return; }
    if (!form.email.trim()) { setError('Informe seu e-mail.'); return; }
    if (!form.gender.trim()) { setError('Selecione seu sexo.'); return; }

    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateDriverProfile(token, {
        birth_date: form.birth_date || undefined,
        cnpj: onlyDigits(form.cnpj) || undefined,
        cpf: onlyDigits(form.cpf) || undefined,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        gender: form.gender,
        phone: onlyDigits(form.phone) || undefined,
        pix_account: form.pix_account.trim() || undefined,
        pix_key_type: form.pix_key_type || undefined,
      });
      const updated = await getDriverProfile(token);
      setProfile(updated);
      setForm(fillForm(updated));
      setIsEditing(false);
      setSuccess('Perfil atualizado com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar seus dados.');
    } finally {
      setIsSaving(false);
    }
  }

  function update(field: keyof ProfileForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
            <Feather color="#071a36" name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.title}>Perfil do motorista</Text>
          <Pressable
            accessibilityLabel={isEditing ? 'Cancelar edição' : 'Editar perfil'}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsEditing((v) => !v); }}
            style={styles.headerButton}>
            <Feather color="#071a36" name={isEditing ? 'x' : 'edit-3'} size={20} />
          </Pressable>
        </View>

        {isLoading ? (
          <ProfileSkeleton />
        ) : (
        <>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {facePhotoUrl ? (
              <Image resizeMode="cover" source={{ uri: facePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <Feather color="#7991a6" name="user" size={54} />
            )}
          </View>
          <Pressable accessibilityLabel="Trocar foto de perfil" disabled={isUploadingPhoto} onPress={handleChangePhoto} style={styles.avatarCamera}>
            <Feather color="#ffb800" name={isUploadingPhoto ? 'loader' : 'camera'} size={20} />
          </Pressable>
        </View>

        <Pressable onPress={() => setIsEditing(true)} style={styles.nameButton}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile?.full_name || 'Motorista SUWAVE'}</Text>
            <Feather color="#ffb800" name="check-circle" size={20} />
          </View>
          <Text style={styles.nameSubtitle}>Motorista parceiro</Text>
        </Pressable>

        <Pressable style={styles.alertCard}>
          <View style={styles.alertIcon}><Text style={styles.alertIconText}>i</Text></View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>Mantenha seus dados atualizados</Text>
            <Text style={styles.alertText}>Informações atualizadas garantem mais segurança e melhor experiência.</Text>
          </View>
          <Feather color="#ffb800" name="chevron-right" size={26} />
        </Pressable>

        {isEditing ? (
          <View style={styles.editCard}>
            <LabeledField icon="user" onChangeText={(v) => update('full_name', v)} placeholder="Nome completo" value={form.full_name} />
            <LabeledField icon="mail" keyboardType="email-address" onChangeText={(v) => update('email', v)} placeholder="E-mail" value={form.email} />
            <LabeledField icon="phone" keyboardType="phone-pad" maxLength={15} onChangeText={(v) => update('phone', maskPhone(v))} placeholder="Telefone / WhatsApp" value={form.phone} />
            <LabeledField icon="calendar" keyboardType="numeric" maxLength={10} onChangeText={(v) => update('birth_date', maskDate(v))} placeholder="Data de nascimento" value={form.birth_date} />
            <RadioGroupField
              label="Sexo"
              onChange={(v) => update('gender', v)}
              options={[
                { label: 'Masculino', value: 'masculino' },
                { label: 'Feminino', value: 'feminino' },
                { label: 'Outros', value: 'outros' },
              ]}
              value={form.gender}
            />
            <LabeledField icon="credit-card" keyboardType="numeric" maxLength={14} onChangeText={(v) => update('cpf', maskCpf(v))} placeholder="CPF" value={form.cpf} />
            <LabeledField icon="briefcase" keyboardType="numeric" maxLength={18} onChangeText={(v) => update('cnpj', maskCnpj(v))} placeholder="CNPJ (opcional)" value={form.cnpj} />
            <LabeledField icon="zap" onChangeText={(v) => update('pix_account', v)} placeholder="Conta Pix" value={form.pix_account} />
            <FormToast message={error} />
            <Pressable disabled={isSaving} onPress={handleSave} style={[styles.primaryAction, isSaving && styles.primaryActionDisabled]}>
              <Feather color="#fff" name="save" size={22} />
              <Text style={styles.primaryActionText}>{isSaving ? 'Salvando...' : 'Salvar alterações'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionTitle}>
              <View style={styles.sectionIcon}><Feather color="#071a36" name="truck" size={18} /></View>
              <Text style={styles.sectionTitleText}>Meus veículos</Text>
            </View>

            {vehicle ? (
              <Pressable onPress={() => router.push('/vehicle-list')} style={styles.vehicleCard}>
                <View style={styles.vehicleImage}>
                  {vehicle.front_photo_url ? (
                    <Image resizeMode="cover" source={{ uri: vehicle.front_photo_url }} style={styles.vehicleThumb} />
                  ) : (
                    <Feather color="#9db4bd" name="image" size={40} />
                  )}
                </View>
                <View style={styles.vehicleCopy}>
                  <Text style={styles.vehicleTitle}>{vehicle.brand} {vehicle.model}</Text>
                  <Text style={styles.vehicleSubtitle}>{vehicle.plate} · {isVehicleApproved(vehicle) ? 'Aprovado' : 'Em análise'}</Text>
                </View>
                <Feather color="#071a36" name="chevron-right" size={22} />
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/vehicle-mode')} style={styles.vehicleCard}>
                <View style={styles.vehicleImage}><Feather color="#9db4bd" name="image" size={40} /></View>
                <View style={styles.vehicleCopy}>
                  <Text style={styles.vehicleTitle}>Adicionar veículo</Text>
                  <Text style={styles.vehicleSubtitle}>Cadastre seu veículo para receber corridas.</Text>
                </View>
                <Feather color="#071a36" name="chevron-right" size={22} />
              </Pressable>
            )}

            <View style={styles.list}>
              <ProfileRow detail={profile?.full_name ?? 'Não informado'} icon="user" iconBg="#eef4ff" iconColor="#195ecf" label="Nome completo" />
              <ProfileRow detail={profile?.phone ?? 'Não informado'} icon="phone" iconBg="transparent" iconColor="#15a548" label="Telefone" />
              <ProfileRow detail={profile?.pix_account ?? 'Não informado'} icon="zap" iconBg="#e5fbf3" iconColor="#12b994" label="Chave PIX" />
              <ProfileRow detail="Gerencie seus avisos e notificações" icon="help-circle" iconBg="#fff4d8" iconColor="#dda400" label="Avisos" />
              <ProfileRow detail="Login, senha e verificação" icon="shield" iconBg="#eaf1ff" iconColor="#174ca3" label="Segurança" />
              <ProfileRow detail="Preferências do app" icon="settings" iconBg="#f0f1f7" iconColor="#263457" label="Configurações" last />
            </View>

            <FormToast message={success || error} tone={success ? 'success' : 'warning'} />

            <Pressable onPress={handleRefresh} style={styles.primaryAction}>
              <Feather color="#fff" name="refresh-cw" size={22} />
              <Text style={styles.primaryActionText}>Atualizar dados</Text>
            </Pressable>

            <Pressable
              onPress={() => logout().then(() => router.replace('/login'))}
              style={styles.logoutAction}>
              <Feather color="#d92525" name="log-out" size={22} />
              <Text style={styles.logoutActionText}>Sair da conta</Text>
            </Pressable>
          </>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileSkeleton() {
  return (
    <View>
      <View style={[styles.avatarWrap, styles.skeletonAvatarWrap]}>
        <SkeletonBox borderRadius={71} height={142} width={142} />
      </View>
      <View style={styles.skeletonNameWrap}>
        <SkeletonBox height={24} width="55%" />
        <SkeletonBox height={16} width="35%" />
      </View>
      <View style={styles.list}>
        <SkeletonBox height={71} />
        <SkeletonBox height={71} />
        <SkeletonBox height={71} />
        <SkeletonBox height={71} />
        <SkeletonBox height={71} />
        <SkeletonBox height={71} />
      </View>
    </View>
  );
}

function ProfileRow({
  detail, icon, iconBg, iconColor, label, last = false,
}: {
  detail: string; icon: keyof typeof Feather.glyphMap;
  iconBg: string; iconColor: string; label: string; last?: boolean;
}) {
  return (
    <Pressable style={[styles.row, last && styles.rowLast]}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Feather color={iconColor} name={icon} size={22} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Feather color="#071a36" name="chevron-right" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SuwaveColors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: SuwaveSpacing.screenVerticalTop, paddingBottom: SuwaveSpacing.screenVerticalBottom },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#081a36', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 2 },
  title: { flex: 1, fontSize: 27, fontWeight: '900', color: '#071a36', textAlign: 'center' },
  avatarWrap: { alignItems: 'center', marginVertical: 4 },
  skeletonAvatarWrap: { marginBottom: 12 },
  skeletonNameWrap: { alignItems: 'center', gap: 8, marginBottom: 20 },
  avatar: { width: 142, height: 142, borderRadius: 71, borderWidth: 4, borderColor: '#fff', backgroundColor: '#f4f7f8', alignItems: 'center', justifyContent: 'center', shadowColor: '#081a36', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 3, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarCamera: { position: 'absolute', right: 4, bottom: 7, width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#081a36', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 2 },
  nameButton: { alignItems: 'center', marginBottom: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 31, fontWeight: '900', color: '#071a36' },
  nameSubtitle: { fontSize: 21, color: '#667188', marginTop: 2 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff6df', borderRadius: 10, padding: 14, minHeight: 88, marginBottom: 18 },
  alertIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 4, borderColor: SuwaveColors.yellow, alignItems: 'center', justifyContent: 'center' },
  alertIconText: { fontSize: 22, fontWeight: '900', color: SuwaveColors.yellow },
  alertCopy: { flex: 1, gap: 3 },
  alertTitle: { fontSize: 17, fontWeight: '800', color: '#071a36' },
  alertText: { fontSize: 14, lineHeight: 18, color: '#4f5d73' },
  editCard: { gap: 12, marginBottom: 18 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  sectionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f2f4f8', alignItems: 'center', justifyContent: 'center' },
  sectionTitleText: { fontSize: 20, fontWeight: '900', color: '#071a36' },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef0f4', borderRadius: 10, padding: 12, marginBottom: 15, shadowColor: '#081a36', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.09, shadowRadius: 18, elevation: 1 },
  vehicleImage: { width: 92, height: 64, borderRadius: 8, backgroundColor: '#f4f7f8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vehicleThumb: { width: '100%', height: '100%' },
  vehicleCopy: { flex: 1, gap: 2 },
  vehicleTitle: { fontSize: 16, fontWeight: '900', color: '#071a36' },
  vehicleSubtitle: { fontSize: 13, color: '#59677c' },
  list: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef0f4', borderRadius: 10, marginBottom: 18, overflow: 'hidden', shadowColor: '#081a36', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 72, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 4 },
  rowLabel: { fontSize: 16, fontWeight: '700', color: '#071a36' },
  rowDetail: { fontSize: 14, color: '#59677c' },
  primaryAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, height: 62, borderRadius: 10, backgroundColor: '#ffba08', marginTop: 4, marginBottom: 14 },
  primaryActionDisabled: { opacity: 0.6 },
  primaryActionText: { fontSize: 20, fontWeight: '900', color: '#fff' },
  logoutAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, height: 62, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef0f4' },
  logoutActionText: { fontSize: 20, fontWeight: '900', color: '#d92525' },
});
