import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS, RADIUS, SHADOW } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import { setBiometricEnabled, updateUser } from '../storage';

export default function ProfileScreen({ user, onLogout, onUserUpdate }) {
  const [name, setName] = useState(user?.name || ''); const [email, setEmail] = useState(user?.email || ''); const [newPassword, setNewPassword] = useState(''); const [loading, setLoading] = useState(false); const [message, setMessage] = useState('');
  const [biometricHardware, setBiometricHardware] = useState(false); const [biometricEnrolled, setBiometricEnrolled] = useState(false); const [biometricBusy, setBiometricBusy] = useState(false);
  const biometricOn = Boolean(user?.biometricEnabled);

  useEffect(() => { checkHardware(); }, []);
  async function checkHardware() {
    try { const hardware = await LocalAuthentication.hasHardwareAsync(); const enrolled = hardware && await LocalAuthentication.isEnrolledAsync(); setBiometricHardware(hardware); setBiometricEnrolled(enrolled); }
    catch { setBiometricHardware(false); setBiometricEnrolled(false); }
  }

  async function saveProfile() {
    if (!name.trim() || !email.trim()) { setMessage('Nome e e-mail são obrigatórios.'); return; }
    if (newPassword && newPassword.length < 4) { setMessage('A nova senha deve ter pelo menos 4 caracteres.'); return; }
    setLoading(true);
    const updated = await updateUser({ name, email, ...(newPassword ? { password: newPassword } : {}) });
    setNewPassword(''); setLoading(false); setMessage('Perfil atualizado com sucesso.');
    if (updated) onUserUpdate?.(updated);
  }

  async function toggleBiometric() {
    if (biometricBusy) return;
    if (biometricOn) {
      Alert.alert('Desativar biometria', 'Você vai precisar de e-mail e senha para entrar da próxima vez. Deseja continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: async () => {
            setBiometricBusy(true);
            const updated = await setBiometricEnabled(false);
            setBiometricBusy(false);
            if (updated) onUserUpdate?.(updated);
          },
        },
      ]);
      return;
    }
    setBiometricBusy(true);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirme para ativar a biometria', cancelLabel: 'Cancelar', disableDeviceFallback: false });
    if (result.success) {
      const updated = await setBiometricEnabled(true);
      setBiometricBusy(false);
      if (updated) onUserUpdate?.(updated);
    } else {
      setBiometricBusy(false);
      Alert.alert('Não foi possível confirmar', 'Tente novamente.');
    }
  }

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.avatar}><Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text></View><Text style={styles.title}>Meu perfil</Text><Text style={styles.subtitle}>Dados da pessoa responsável pelos registros.</Text><View style={styles.card}><Text style={styles.sectionTitle}>Dados cadastrados</Text><Text style={styles.label}>NOME</Text><TextInput style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" /><Text style={styles.label}>E-MAIL</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Text style={styles.label}>NOVA SENHA (OPCIONAL)</Text><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Deixe em branco para manter" placeholderTextColor={COLORS.muted} /><PrimaryButton title={loading ? 'Salvando...' : 'Salvar alterações'} onPress={saveProfile} disabled={loading} />{message ? <Text style={styles.message}>{message}</Text> : null}</View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Biometria</Text>
      {biometricHardware && biometricEnrolled ? (
        <>
          <View style={styles.bioRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bioTitle}>{biometricOn ? 'Biometria ativada' : 'Biometria desativada'}</Text>
              <Text style={styles.bioText}>{biometricOn ? 'Você pode entrar com a digital/rosto e o app trava sozinho ao voltar do segundo plano.' : 'Ative para entrar mais rápido, sem digitar a senha toda vez.'}</Text>
            </View>
            <View style={[styles.bioDot, { backgroundColor: biometricOn ? COLORS.green : COLORS.border }]} />
          </View>
          <PrimaryButton title={biometricBusy ? 'Aguarde...' : biometricOn ? 'Desativar biometria' : 'Ativar biometria'} variant={biometricOn ? 'secondary' : 'primary'} onPress={toggleBiometric} disabled={biometricBusy} />
        </>
      ) : (
        <Text style={styles.bioText}>{biometricHardware ? 'Cadastre uma digital ou rosto nas configurações do aparelho para poder ativar aqui.' : 'Este aparelho não informou suporte à biometria.'}</Text>
      )}
    </View>

    <View style={styles.accountCard}><Text style={styles.accountTitle}>Sessão</Text><Text style={styles.accountText}>O login salvo expira automaticamente após 30 minutos.</Text><PrimaryButton title="Sair da conta" variant="secondary" onPress={() => Alert.alert('Sair da conta', 'Deseja encerrar esta sessão?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: onLogout }])} /></View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 20, paddingBottom: 35 }, avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue, alignSelf: 'center', marginTop: 12 }, avatarText: { color: '#fff', fontSize: 32, fontWeight: '900' }, title: { color: COLORS.text, fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 12 }, subtitle: { color: COLORS.muted, fontSize: 14, textAlign: 'center', marginTop: 5, marginBottom: 18 }, card: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 15, ...SHADOW }, sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }, label: { color: COLORS.muted, fontSize: 11, fontWeight: '900', marginTop: 9, marginBottom: 6 }, input: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 12, color: COLORS.text, backgroundColor: COLORS.bg }, message: { color: COLORS.green, textAlign: 'center', fontWeight: '800', marginTop: -5, marginBottom: 8 }, bioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, bioTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' }, bioText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }, bioDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 10 }, accountCard: { backgroundColor: COLORS.paleBlue, borderRadius: RADIUS.control, padding: 16, marginTop: 15 }, accountTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' }, accountText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 } });
