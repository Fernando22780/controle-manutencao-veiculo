import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS, RADIUS } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import { createUser, getUser, setBiometricEnabled, validateUser } from '../storage';

export default function AuthScreen({ mode = 'login', onSuccess, onChangeMode, sessionExpired = false, onBiometricLogin }) {
  const isRegister = mode === 'register';
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [keepLogged, setKeepLogged] = useState(true); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [canUseBiometric, setCanUseBiometric] = useState(false); const [biometricHardware, setBiometricHardware] = useState(false); const [showPassword, setShowPassword] = useState(false); const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [biometricOffer, setBiometricOffer] = useState(null); const [offerLoading, setOfferLoading] = useState(false);

  useEffect(() => { checkBiometric(); }, []);
  async function checkBiometric() { try { const user = await getUser(); const hardware = await LocalAuthentication.hasHardwareAsync(); const enrolled = hardware && await LocalAuthentication.isEnrolledAsync(); setBiometricHardware(hardware); setCanUseBiometric(Boolean(user?.biometricEnabled && enrolled)); } catch { setBiometricHardware(false); setCanUseBiometric(false); } }

  async function submit() {
    setError('');
    if (!email.trim() || !password) { setError('Informe e-mail e senha para continuar.'); return; }
    if (isRegister) {
      if (!name.trim()) { setError('Informe seu nome.'); return; }
      if (password.length < 4) { setError('A senha deve ter pelo menos 4 caracteres.'); return; }
      if (password !== confirmPassword) { setError('As senhas não conferem.'); return; }
      const existing = await getUser();
      if (existing && existing.email === email.trim().toLowerCase()) { setError('Este e-mail já possui cadastro. Acesse a opção Entrar.'); return; }
      setLoading(true); const user = await createUser({ name, email, password }); setLoading(false);
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hardware && await LocalAuthentication.isEnrolledAsync();
      if (enrolled) { setBiometricOffer(user); return; }
      onSuccess(user, true); return;
    }
    setLoading(true); const result = await validateUser(email, password); setLoading(false);
    if (!result.ok) { setError(result.message); return; }
    onSuccess(result.user, keepLogged);
  }

  async function enableBiometricAndFinish() {
    setOfferLoading(true);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirme para vincular a biometria', cancelLabel: 'Cancelar', disableDeviceFallback: false });
    if (result.success) { const updated = await setBiometricEnabled(true); setOfferLoading(false); onSuccess(updated ?? biometricOffer, true); }
    else { setOfferLoading(false); Alert.alert('Não foi possível confirmar', 'Tente novamente ou pule esta etapa.'); }
  }
  function skipBiometricAndFinish() { onSuccess(biometricOffer, true); }

  async function biometricLogin() { setError(''); setLoading(true); const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Acessar com biometria', cancelLabel: 'Cancelar', disableDeviceFallback: false }); setLoading(false); if (result.success) onBiometricLogin(); else setError('Biometria não concluída. Tente novamente.'); }
  function showBiometricSetup() { Alert.alert('Cadastrar biometria', 'Abra as configurações do Android, entre em Segurança ou Biometria, cadastre sua digital ou rosto e depois volte ao aplicativo.'); }

  if (biometricOffer) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.offerWrap}>
          <View style={styles.offerIcon}><Text style={styles.offerIconText}>◉</Text></View>
          <Text style={styles.title}>Usar biometria para entrar?</Text>
          <Text style={styles.subtitle}>Da próxima vez você pode acessar sua conta com a digital ou o rosto, sem digitar a senha.</Text>
          <View style={styles.card}>
            <PrimaryButton title={offerLoading ? 'Confirmando...' : 'Ativar biometria'} onPress={enableBiometricAndFinish} disabled={offerLoading} />
            <PrimaryButton title="Agora não" variant="secondary" onPress={skipBiometricAndFinish} disabled={offerLoading} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}><Image source={require('../../assets/app-icon.png')} style={styles.brandImage} /></View>
          <Text style={styles.kicker}>CONTROLE DE MANUTENÇÃO DE VEÍCULOS</Text>
          <Text style={styles.title}>{isRegister ? 'Crie sua conta' : 'Bem-vindo de volta'}</Text>
          <Text style={styles.subtitle}>{sessionExpired ? 'Sua sessão expirou após 30 minutos. Entre novamente.' : isRegister ? 'Cadastre seus dados para acessar seus registros.' : 'Entre para continuar cuidando do seu veículo.'}</Text>
          {error ? <View style={styles.errorBox}><Text style={styles.errorIcon}>!</Text><Text style={styles.errorText}>{error}</Text></View> : null}
          <View style={styles.card}>
            {isRegister && <Field label="Nome" placeholder="Como podemos chamar você?" value={name} onChangeText={setName} autoCapitalize="words" />}
            <Field label="E-mail" placeholder="voce@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Senha" placeholder="Digite sua senha" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} returnKeyType={isRegister ? 'next' : 'done'} onToggleSecure={() => setShowPassword(!showPassword)} secureVisible={showPassword} />
            {isRegister && <Field label="Confirmar senha" placeholder="Repita sua senha" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} returnKeyType="done" onToggleSecure={() => setShowConfirmPassword(!showConfirmPassword)} secureVisible={showConfirmPassword} />}
            {!isRegister && <Pressable style={styles.keepRow} onPress={() => setKeepLogged(!keepLogged)}><View style={[styles.checkbox, keepLogged && styles.checkboxOn]}>{keepLogged && <Text style={styles.check}>✓</Text>}</View><View style={styles.keepCopy}><Text style={styles.keepTitle}>Manter logado</Text><Text style={styles.keepHint}>A sessão expira automaticamente após 30 minutos.</Text></View></Pressable>}
            <PrimaryButton title={loading ? 'Aguarde...' : isRegister ? 'Cadastrar' : 'Entrar'} onPress={submit} disabled={loading} />
            {!isRegister && canUseBiometric && <Pressable style={styles.biometricButton} onPress={biometricLogin} disabled={loading}><Text style={styles.biometricIcon}>◉</Text><Text style={styles.biometricText}>Acessar com biometria</Text></Pressable>}
            {!isRegister && !canUseBiometric && biometricHardware && <><Pressable style={styles.biometricSetup} onPress={showBiometricSetup}><Text style={styles.biometricSetupText}>Cadastrar biometria nas configurações</Text></Pressable><Text style={styles.biometricHint}>Depois de cadastrar a digital ou o rosto no Android, volte ao aplicativo para aparecer o botão “Acessar com biometria”.</Text></>}
            {!isRegister && !biometricHardware && <Text style={styles.biometricHint}>Este aparelho não informou suporte à biometria. Use e-mail e senha para entrar.</Text>}
          </View>
          <Pressable onPress={() => { setError(''); onChangeMode(isRegister ? 'login' : 'register'); }} style={styles.switchButton}><Text style={styles.switchText}>{isRegister ? 'Já tenho uma conta. ' : 'Ainda não tenho conta. '}<Text style={styles.switchStrong}>{isRegister ? 'Entrar' : 'Cadastrar'}</Text></Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function Field({ label, onToggleSecure, secureVisible, ...props }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{onToggleSecure ? <View style={styles.passwordWrap}><TextInput style={styles.inputPassword} placeholderTextColor={COLORS.muted} {...props} /><Pressable onPress={onToggleSecure} style={styles.eyeButton}><Text style={styles.eye}>{secureVisible ? '◉' : '◌'}</Text></Pressable></View> : <TextInput style={styles.input} placeholderTextColor={COLORS.muted} {...props} />}</View>; }
const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1, backgroundColor: COLORS.navyDeep }, content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 45 }, brand: { width: 68, height: 68, borderRadius: 20, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16, overflow: 'hidden' }, brandImage: { width: 68, height: 68 }, kicker: { color: COLORS.blueBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' }, title: { color: '#fff', fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 7 }, subtitle: { color: '#B8CBD2', textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 16 }, errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4a2029', borderWidth: 1, borderColor: '#9d4854', borderRadius: 12, padding: 11, marginBottom: 12 }, errorIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#e8717e', color: '#4a2029', textAlign: 'center', lineHeight: 22, fontWeight: '900', marginRight: 9 }, errorText: { color: '#ffd9dc', flex: 1, fontSize: 13, lineHeight: 18 }, card: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 18 }, field: { marginBottom: 12 }, label: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginBottom: 6 }, input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, paddingHorizontal: 13, color: COLORS.text, fontSize: 14 }, passwordWrap: { position: 'relative', justifyContent: 'center' }, inputPassword: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, paddingHorizontal: 13, paddingRight: 48, color: COLORS.text, fontSize: 14 }, eyeButton: { position: 'absolute', right: 8, width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }, eye: { color: COLORS.blue, fontSize: 22 }, keepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 14 }, checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' }, checkboxOn: { backgroundColor: COLORS.blue }, check: { color: '#fff', fontWeight: '900', fontSize: 15 }, keepCopy: { flex: 1, marginLeft: 9 }, keepTitle: { color: COLORS.text, fontSize: 13, fontWeight: '800' }, keepHint: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, biometricButton: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 2 }, biometricIcon: { color: COLORS.blue, fontSize: 20, marginRight: 8 }, biometricText: { color: COLORS.blue, fontSize: 13, fontWeight: '900' }, biometricSetup: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 3 }, biometricSetupText: { color: COLORS.blue, fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' }, biometricHint: { color: COLORS.muted, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4 }, switchButton: { alignItems: 'center', padding: 16 }, switchText: { color: '#B8CBD2', fontSize: 13 }, switchStrong: { color: COLORS.blueBright, fontWeight: '900' }, offerWrap: { flex: 1, justifyContent: 'center', padding: 24 }, offerIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }, offerIconText: { color: '#fff', fontSize: 30 } });
