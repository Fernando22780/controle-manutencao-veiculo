import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import PhotoEditor from '../components/PhotoEditor';
import { setBiometricEnabled, updatePassword, updateUser } from '../storage';
import { beginPhotoPickerActivity, endPhotoPickerActivity } from '../photoPickerState';

export default function ProfileScreen({ user, onLogout, onUserUpdate }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoNotice, setPhotoNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [biometricHardware, setBiometricHardware] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const biometricOn = Boolean(user?.biometricEnabled);

  useEffect(() => { checkHardware(); }, []);
  async function checkHardware() {
    try { const hardware = await LocalAuthentication.hasHardwareAsync(); const enrolled = hardware && await LocalAuthentication.isEnrolledAsync(); setBiometricHardware(hardware); setBiometricEnrolled(enrolled); }
    catch { setBiometricHardware(false); setBiometricEnrolled(false); }
  }

  async function saveProfile() {
    setMessage('');
    if (!name.trim() || !email.trim()) { setMessage('Nome e e-mail são obrigatórios.'); return; }
    const changingPassword = Boolean(currentPassword || newPassword || confirmPassword);
    if (changingPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) { setMessage('Para alterar a senha, preencha a senha antiga, a nova senha e a confirmação.'); return; }
      if (newPassword.length < 4) { setMessage('A nova senha deve ter pelo menos 4 caracteres.'); return; }
      if (newPassword !== confirmPassword) { setMessage('A nova senha e a confirmação não coincidem.'); return; }
    }
    setLoading(true);
    try {
      let updated = user;
      if (changingPassword) {
        const passwordResult = await updatePassword(currentPassword, newPassword);
        if (!passwordResult.ok) { setMessage(passwordResult.message); setLoading(false); return; }
        updated = passwordResult.user;
      }
      updated = await updateUser({ name, email, profilePhoto });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setMessage('Perfil atualizado com sucesso.');
      if (updated) onUserUpdate?.(updated);
    } catch {
      setMessage('Não foi possível guardar as alterações. Tente novamente.');
    } finally { setLoading(false); }
  }

  async function savePhoto(uri) {
    const updated = await updateUser({ profilePhoto: uri });
    if (!updated) throw new Error('Não foi possível atualizar o perfil.');
    setProfilePhoto(uri);
    onUserUpdate?.(updated);
  }

  async function pickProfilePhoto(source) {
    if (photoSaving) return;
    const usingCamera = source === 'camera';
    setPhotoSaving(true);
    setPhotoNotice('');
    beginPhotoPickerActivity();
    try {
      if (usingCamera || Platform.OS !== 'android') {
        const permission = usingCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permissão necessária', usingCamera ? 'Permita o acesso à câmara para tirar uma foto de perfil.' : 'Permita o acesso às fotografias para escolher uma foto de perfil.');
          return;
        }
      }
      const options = { mediaTypes: ['images'], allowsEditing: false, quality: 0.9 };
      const result = usingCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) { Alert.alert('Foto não carregada', 'Não recebemos a imagem. Tente escolher ou tirar a foto novamente.'); return; }
      setPendingPhotoUri(uri); // abre a prévia com "Recortar" e "Concluir"
    } catch (error) {
      console.warn('Falha ao carregar/salvar a foto de perfil:', error);
      Alert.alert('Não foi possível carregar a foto', usingCamera ? 'Verifique a permissão da câmara e tente novamente.' : 'Verifique a permissão das fotos e tente novamente.');
    } finally { endPhotoPickerActivity(); setPhotoSaving(false); }
  }
  async function confirmPhoto(uriToSave = pendingPhotoUri) {
    if (!uriToSave || photoSaving) return;
    setPhotoSaving(true);
    try {
      await savePhoto(uriToSave);
      setPendingPhotoUri(null);
      setPhotoNotice('Foto de perfil atualizada.');
    } catch (error) {
      console.warn('Falha ao confirmar a foto de perfil:', error);
      Alert.alert('Não foi possível salvar a foto', 'Tente novamente.');
    } finally { setPhotoSaving(false); }
  }
  function takeProfilePhoto() { pickProfilePhoto('camera'); }
  function chooseProfilePhoto() { pickProfilePhoto('gallery'); }
  async function removeProfilePhoto() {
    try {
      const updated = await updateUser({ profilePhoto: null });
      if (!updated) throw new Error('Não foi possível atualizar o perfil.');
      setProfilePhoto(null);
      onUserUpdate?.(updated);
      setPhotoNotice('Foto de perfil removida.');
    } catch {
      Alert.alert('Não foi possível remover a foto', 'Tente novamente.');
    }
  }

  async function toggleBiometric() {
    if (biometricBusy) return;
    if (biometricOn) {
      Alert.alert('Desativar biometria', 'Você vai precisar de e-mail e senha para entrar da próxima vez. Deseja continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desativar', style: 'destructive', onPress: async () => { setBiometricBusy(true); const updated = await setBiometricEnabled(false); setBiometricBusy(false); if (updated) onUserUpdate?.(updated); } },
      ]);
      return;
    }
    setBiometricBusy(true);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirme para ativar a biometria', cancelLabel: 'Cancelar', disableDeviceFallback: false });
    if (result.success) { const updated = await setBiometricEnabled(true); setBiometricBusy(false); if (updated) onUserUpdate?.(updated); }
    else { setBiometricBusy(false); Alert.alert('Não foi possível confirmar', 'Tente novamente.'); }
  }

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <PhotoEditor visible={Boolean(pendingPhotoUri)} uri={pendingPhotoUri} saving={photoSaving} onCancel={() => { if (!photoSaving) setPendingPhotoUri(null); }} onConfirm={confirmPhoto} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={chooseProfilePhoto} accessibilityRole="button" accessibilityLabel="Escolher foto de perfil" style={styles.avatarWrap}>
          {profilePhoto ? <Image source={{ uri: profilePhoto }} style={styles.avatarImage} /> : <View style={styles.avatar}><Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text></View>}
        </Pressable>
        <View style={styles.photoActions}>
          <Pressable onPress={takeProfilePhoto} disabled={photoSaving} style={styles.photoActionButton} accessibilityRole="button"><MaterialCommunityIcons name="camera-outline" size={17} color={COLORS.green} /><Text style={styles.photoActionText}>Tirar foto</Text></Pressable>
          <Pressable onPress={chooseProfilePhoto} disabled={photoSaving} style={[styles.photoActionButton, styles.photoActionPrimary]} accessibilityRole="button"><MaterialCommunityIcons name="image-outline" size={17} color="#fff" /><Text style={styles.photoActionPrimaryText}>Escolher foto</Text></Pressable>
        </View>
        {profilePhoto ? <Pressable onPress={removeProfilePhoto} style={styles.photoRemoveButton}><Text style={styles.photoRemoveText}>Remover foto</Text></Pressable> : null}
        {photoNotice ? <Text style={styles.photoNotice}>{photoNotice}</Text> : null}
        <Text style={styles.title}>Meu perfil</Text><Text style={styles.subtitle}>Dados da pessoa responsável pelos registros.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados cadastrados</Text>
          <Text style={styles.label}>NOME</Text><TextInput style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" placeholder="O seu nome" placeholderTextColor={COLORS.muted} />
          <Text style={styles.label}>E-MAIL</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="voce@email.com" placeholderTextColor={COLORS.muted} />
        </View>

        <View style={styles.card}>
          <View style={styles.passwordHeading}><MaterialCommunityIcons name="lock-reset" size={22} color={COLORS.blue} /><Text style={styles.sectionTitle}>Alterar senha</Text></View>
          <Text style={styles.passwordHint}>Para sua segurança, confirme primeiro a senha que usa atualmente.</Text>
          <Text style={styles.label}>SENHA ANTIGA</Text><TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" placeholder="Digite a senha atual" placeholderTextColor={COLORS.muted} />
          <Text style={styles.label}>NOVA SENHA</Text><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" placeholder="Digite a nova senha" placeholderTextColor={COLORS.muted} />
          <Text style={styles.label}>CONFIRMAR NOVA SENHA</Text><TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Digite novamente a nova senha" placeholderTextColor={COLORS.muted} />
          <PrimaryButton title={loading ? 'Salvando...' : 'Salvar alterações'} onPress={saveProfile} disabled={loading} />
          {message ? <Text style={[styles.message, message.includes('sucesso') ? styles.success : styles.error]}>{message}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Biometria</Text>
          {biometricHardware && biometricEnrolled ? <>
            <View style={styles.bioRow}><View style={{ flex: 1 }}><Text style={styles.bioTitle}>{biometricOn ? 'Biometria ativada' : 'Biometria desativada'}</Text><Text style={styles.bioText}>{biometricOn ? 'Você pode entrar com digital/rosto e o app bloqueia ao voltar do segundo plano.' : 'Ative para entrar mais rápido, sem digitar a senha toda vez.'}</Text></View><View style={[styles.bioDot, { backgroundColor: biometricOn ? COLORS.green : COLORS.border }]} /></View>
            <PrimaryButton title={biometricBusy ? 'Aguarde...' : biometricOn ? 'Desativar biometria' : 'Ativar biometria'} variant={biometricOn ? 'secondary' : 'primary'} onPress={toggleBiometric} disabled={biometricBusy} />
          </> : <Text style={styles.bioText}>{biometricHardware ? 'Cadastre uma digital ou rosto nas configurações do aparelho para poder ativar aqui.' : 'Este aparelho não informou suporte à biometria.'}</Text>}
        </View>

        <View style={styles.accountCard}><Text style={styles.accountTitle}>Sessão</Text><Text style={styles.accountText}>O login salvo expira automaticamente após 30 minutos.</Text><PrimaryButton title="Sair da conta" variant="secondary" onPress={() => Alert.alert('Sair da conta', 'Deseja encerrar esta sessão?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: onLogout }])} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 20, paddingBottom: 35 },
  avatarWrap: { alignSelf: 'center', marginTop: 8 }, avatar: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue }, avatarText: { color: '#fff', fontSize: 38, fontWeight: '900' }, avatarImage: { width: 94, height: 94, borderRadius: 47, backgroundColor: COLORS.paleBlue, borderWidth: 3, borderColor: COLORS.card }, photoActions: { flexDirection: 'row', justifyContent: 'center', gap: 9, marginTop: 12 }, photoActionButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card }, photoActionPrimary: { backgroundColor: COLORS.green, borderColor: COLORS.green }, photoActionText: { color: COLORS.green, fontSize: 12, fontWeight: '900' }, photoActionPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' }, photoRemoveButton: { alignSelf: 'center', paddingVertical: 7, paddingHorizontal: 12 }, photoRemoveText: { color: COLORS.muted, fontSize: 11, fontWeight: '800' }, photoNotice: { color: COLORS.green, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 7 },
  title: { color: COLORS.text, fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 12 }, subtitle: { color: COLORS.muted, fontSize: 14, textAlign: 'center', marginTop: 5, marginBottom: 4 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 15, ...SHADOW }, sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginLeft: 6 }, label: { color: COLORS.muted, fontSize: 11, fontWeight: '900', marginTop: 13, marginBottom: 6 }, input: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 12, color: COLORS.text, backgroundColor: COLORS.bg }, passwordHeading: { flexDirection: 'row', alignItems: 'center' }, passwordHint: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 6 }, message: { textAlign: 'center', fontWeight: '800', marginTop: 10, lineHeight: 18 }, success: { color: COLORS.green }, error: { color: COLORS.red || '#B42318' },
  bioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, bioTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' }, bioText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }, bioDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 10 }, accountCard: { backgroundColor: COLORS.paleBlue, borderRadius: RADIUS.control, padding: 16, marginTop: 15 }, accountTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' }, accountText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 },
  photoEditorCard: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: COLORS.card, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, padding: 18, marginTop: 15, ...SHADOW }, photoEditorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, photoEditorEyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, photoEditorTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 3 }, photoEditorClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }, photoPreviewFrame: { width: '100%', height: 270, borderRadius: 18, backgroundColor: COLORS.navyDeep, overflow: 'hidden', marginTop: 15, alignItems: 'center', justifyContent: 'center' }, photoPreviewImage: { width: '100%', height: '100%' }, photoCropOverlay: { position: 'absolute', top: 10, right: 10, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(7,31,27,0.92)' }, photoCropOverlayText: { color: '#fff', fontSize: 12, fontWeight: '900' }, photoEditorHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 11, marginBottom: 12, textAlign: 'center' }, photoEditorError: { color: COLORS.red, fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 10 }, photoEditorActions: { flexDirection: 'row', gap: 10 }, photoEditorButton: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, photoEditorSecondary: { backgroundColor: COLORS.paleBlue, borderWidth: 1, borderColor: '#D4EBDD' }, photoEditorPrimary: { backgroundColor: COLORS.green }, photoEditorSecondaryText: { color: COLORS.green, fontSize: 14, fontWeight: '900' }, photoEditorPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '900' }, photoEditorPressed: { opacity: 0.78 }, photoEditorDisabled: { opacity: 0.55 }, photoEditorCancel: { alignItems: 'center', paddingTop: 12, paddingBottom: 3 }, photoEditorCancelText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
});
