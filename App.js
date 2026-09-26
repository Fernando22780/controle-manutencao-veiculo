import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from './src/theme';
import PrimaryButton from './src/components/PrimaryButton';
import HomeScreen from './src/screens/HomeScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';
import CameraScreen from './src/screens/CameraScreen';
import RecordDetailScreen from './src/screens/RecordDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AuthScreen from './src/screens/AuthScreen';
import CenteredMessage from './src/components/CenteredMessage';
import { clearSession, getActiveSession, getUser, saveSession } from './src/storage';

const Tab = createBottomTabNavigator(); const Stack = createNativeStackNavigator();
const tabs = { Início: '⌂', Manutenções: '✓', Comprovante: '▣', Perfil: '●' };

export default function App() {
  const [checking, setChecking] = useState(true); const [authenticated, setAuthenticated] = useState(false); const [authMode, setAuthMode] = useState('login'); const [sessionExpired, setSessionExpired] = useState(false); const [user, setUser] = useState(null);
  const [locked, setLocked] = useState(false); const [unlocking, setUnlocking] = useState(false);
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef(null);
  useEffect(() => { prepareAuth(); }, []);
  useEffect(() => {
    if (!authenticated || !user) return undefined;
    let timer;
    getActiveSession().then((session) => {
      if (session) timer = setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
    });
    return () => { if (timer) clearTimeout(timer); };
  }, [authenticated, user]);
  // Sempre que o app volta do segundo plano, se a pessoa vinculou biometria,
  // a tela fica bloqueada até confirmar a digital/rosto de novo.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appState.current;
      if (nextState === 'background') backgroundedAt.current = Date.now();
      const cameFromRealBackground = previousState === 'background' && nextState === 'active';
      const stayedInBackground = backgroundedAt.current && Date.now() - backgroundedAt.current >= 1000;
      if (cameFromRealBackground && stayedInBackground && authenticated && user?.biometricEnabled) setLocked(true);
      if (nextState === 'active') backgroundedAt.current = null;
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [authenticated, user]);
  async function prepareAuth() {
    const savedUser = await getUser(); const session = await getActiveSession();
    setUser(savedUser); setAuthMode(savedUser ? 'login' : 'register');
    if (session && savedUser && session.userId === savedUser.id) setAuthenticated(true);
    else if (savedUser) setSessionExpired(Boolean(session === null));
    setChecking(false);
  }
  async function finishLogin(loggedUser, keepLogged) { setUser(loggedUser); await saveSession(loggedUser.id, keepLogged); setAuthenticated(true); setSessionExpired(false); }
  async function biometricLogin() {
    const savedUser = await getUser();
    if (!savedUser) return;
    setUser(savedUser); await saveSession(savedUser.id, true); setAuthenticated(true); setSessionExpired(false);
  }
  async function logout() { await clearSession(); setAuthenticated(false); setAuthMode('login'); setSessionExpired(false); }
  async function unlockWithBiometric() {
    setUnlocking(true);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear Controle de Manutenção', cancelLabel: 'Cancelar', disableDeviceFallback: false });
    setUnlocking(false);
    if (result.success) setLocked(false);
  }
  if (checking) return <CenteredMessage text="Preparando acesso..." />;
  if (!authenticated) return <AuthScreen mode={authMode} onChangeMode={setAuthMode} onSuccess={finishLogin} sessionExpired={sessionExpired} onBiometricLogin={biometricLogin} />;
  return <SafeAreaProvider><View style={styles.appRoot}><NavigationContainer><StatusBar style="dark" /><Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.card }, headerTintColor: COLORS.text, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false }}><Stack.Screen name="MainTabs" options={{ headerShown: false }}>{(props) => <TabNavigator {...props} user={user} onLogout={logout} onUserUpdate={setUser} />}</Stack.Screen><Stack.Screen name="RecordDetail" component={RecordDetailScreen} options={{ title: 'Detalhes do registro' }} /></Stack.Navigator></NavigationContainer>{locked ? <View style={styles.lockOverlay}><LockScreen loading={unlocking} onUnlock={unlockWithBiometric} onLogout={logout} /></View> : null}</View></SafeAreaProvider>;
}

function LockScreen({ loading, onUnlock, onLogout }) {
  useEffect(() => { onUnlock(); }, []);
  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockIcon}><Text style={styles.lockIconText}>◉</Text></View>
      <Text style={styles.lockTitle}>Aplicativo bloqueado</Text>
      <Text style={styles.lockText}>Confirme sua biometria para continuar de onde parou.</Text>
      <View style={styles.lockButton}><PrimaryButton title={loading ? 'Verificando...' : 'Desbloquear com biometria'} onPress={onUnlock} disabled={loading} /></View>
      <Text style={styles.lockLogout} onPress={onLogout}>Sair da conta</Text>
    </View>
  );
}

function TabNavigator({ user, onLogout, onUserUpdate }) {
  const insets = useSafeAreaInsets();
  const HomeRoute = (props) => <HomeScreen {...props} user={user} />;
  const ProfileRoute = (props) => <ProfileScreen {...props} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />;
  return <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: COLORS.blue, tabBarInactiveTintColor: COLORS.muted, tabBarLabelStyle: styles.tabLabel, tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>{tabs[route.name]}</Text>, tabBarStyle: [styles.tabBar, { height: 70 + insets.bottom, paddingBottom: insets.bottom + 8 }], tabBarHideOnKeyboard: true })}><Tab.Screen name="Início" component={HomeRoute} /><Tab.Screen name="Manutenções" component={MaintenanceScreen} /><Tab.Screen name="Comprovante" component={CameraScreen} /><Tab.Screen name="Perfil" component={ProfileRoute} /></Tab.Navigator>;
}
const styles = StyleSheet.create({ appRoot: { flex: 1 }, lockOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 }, tabBar: { borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card, elevation: 10, shadowColor: COLORS.navy, shadowOpacity: 0.08, shadowRadius: 8 }, tabLabel: { fontSize: 10, fontWeight: '800' }, tabIcon: { fontSize: 19, fontWeight: '800' }, lockScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: COLORS.navyDeep }, lockIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, lockIconText: { color: '#fff', fontSize: 30 }, lockTitle: { color: '#fff', fontSize: 22, fontWeight: '900' }, lockText: { color: '#B8CBD2', textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 20 }, lockButton: { width: '100%' }, lockLogout: { color: '#B8CBD2', fontSize: 13, fontWeight: '700', marginTop: 14, textDecorationLine: 'underline' } });
