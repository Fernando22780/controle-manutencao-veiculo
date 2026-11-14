import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from './src/theme';
import PrimaryButton from './src/components/PrimaryButton';
import HomeScreen from './src/screens/HomeScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';
import CameraScreen from './src/screens/CameraScreen';
import RecordDetailScreen from './src/screens/RecordDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AuthScreen from './src/screens/AuthScreen';
import TravelCostScreen from './src/screens/TravelCostScreen';
import { clearSession, getActiveSession, getUser, saveSession } from './src/storage';
import { trackPhotoPickerAppState } from './src/photoPickerState';
import { syncPending } from './src/sync';
import { configureNotifications } from './src/notifications';
import { shouldDismissBiometricLock } from './src/biometricUtils';

SplashScreen.preventAutoHideAsync().catch(() => {});
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const Tab = createBottomTabNavigator(); const Stack = createNativeStackNavigator();
const tabs = { Início: 'home-variant-outline', Manutenções: 'wrench-outline', Viagem: 'gas-station-outline', Comprovantes: 'receipt-text-outline', Perfil: 'account-circle-outline' };

export default function App() {
  const [checking, setChecking] = useState(true); const [authenticated, setAuthenticated] = useState(false); const [authMode, setAuthMode] = useState('login'); const [sessionExpired, setSessionExpired] = useState(false); const [user, setUser] = useState(null);
  const [locked, setLocked] = useState(false); const [unlocking, setUnlocking] = useState(false);
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef(null);
  useEffect(() => { prepareAuth(); }, []);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) syncPending().catch(() => {});
    });
    syncPending().catch(() => {});
    return unsubscribe;
  }, []);
  useEffect(() => { if (authenticated) configureNotifications().catch(() => {}); }, [authenticated]);
  useEffect(() => {
    if (!authenticated || !user) return undefined;
    let timer;
    getActiveSession().then((session) => {
      if (session) timer = setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
    });
    return () => { if (timer) clearTimeout(timer); };
  }, [authenticated, user]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appState.current;
      const returnedFromPhotoPicker = trackPhotoPickerAppState(nextState);
      if (nextState === 'background') backgroundedAt.current = Date.now();
      const cameFromRealBackground = previousState === 'background' && nextState === 'active';
      const stayedInBackground = backgroundedAt.current && Date.now() - backgroundedAt.current >= 1000;
      if (!returnedFromPhotoPicker && cameFromRealBackground && stayedInBackground && authenticated && user?.biometricEnabled) setLocked(true);
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
    await SplashScreen.hideAsync();
    await new Promise((resolve) => setTimeout(resolve, 4000));
    setChecking(false);
  }
  async function finishLogin(loggedUser, keepLogged) { setUser(loggedUser); await saveSession(loggedUser.id, keepLogged); setAuthenticated(true); setSessionExpired(false); }
  async function biometricLogin(loggedUser) {
    const savedUser = loggedUser ?? await getUser();
    if (!savedUser) return;
    setUser(savedUser); await saveSession(savedUser.id, true); setAuthenticated(true); setSessionExpired(false);
  }
  async function logout() { await clearSession(); setAuthenticated(false); setAuthMode('login'); setSessionExpired(false); }
  async function unlockWithBiometric() {
    if (unlocking) return;
    setUnlocking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear Controle de Manutenção', cancelLabel: 'Cancelar', disableDeviceFallback: false });
      if (shouldDismissBiometricLock(result)) setLocked(false);
    } catch {
      Alert.alert('Biometria indisponível', 'Tente novamente ou saia da conta.');
    } finally {
      setUnlocking(false);
    }
  }
  if (checking) return <LoadingScreen />;
  if (!authenticated) return <AuthScreen mode={authMode} onChangeMode={setAuthMode} onSuccess={finishLogin} sessionExpired={sessionExpired} onBiometricLogin={biometricLogin} />;
  return <SafeAreaProvider><View style={styles.appRoot}><NavigationContainer><StatusBar style="dark" /><Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.card }, headerTintColor: COLORS.text, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false }}><Stack.Screen name="MainTabs" options={{ headerShown: false }}>{(props) => <TabNavigator {...props} user={user} onLogout={logout} onUserUpdate={setUser} />}</Stack.Screen><Stack.Screen name="RecordDetail" component={RecordDetailScreen} options={{ title: 'Detalhes do registro' }} /></Stack.Navigator></NavigationContainer>{locked ? <View style={styles.lockOverlay}><LockScreen loading={unlocking} onUnlock={unlockWithBiometric} onLogout={logout} /></View> : null}</View></SafeAreaProvider>;
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <Image source={require('./assets/app-icon.png')} style={styles.loadingLogo} resizeMode="contain" accessibilityLabel="Logo Controle de Manutenção de Veículos" />
      <Text style={styles.loadingTitle}>CONTROLE DE MANUTENÇÃO</Text>
      <Text style={styles.loadingSubtitle}>DE VEÍCULOS</Text>
      <ActivityIndicator size="small" color={COLORS.mint} style={styles.loadingIndicator} accessibilityLabel="Carregando" />
    </View>
  );
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
  return <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: COLORS.green, tabBarInactiveTintColor: COLORS.muted, tabBarLabelStyle: styles.tabLabel, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={tabs[route.name]} color={color} size={size + 2} />, tabBarStyle: [styles.tabBar, { height: 76 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 7 }], tabBarHideOnKeyboard: true })}><Tab.Screen name="Início" component={HomeRoute} /><Tab.Screen name="Manutenções" component={MaintenanceScreen} /><Tab.Screen name="Viagem" component={TravelCostScreen} /><Tab.Screen name="Comprovantes" component={CameraScreen} /><Tab.Screen name="Perfil" component={ProfileRoute} /></Tab.Navigator>;
}
const styles = StyleSheet.create({ loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#042D21' }, loadingLogo: { width: 220, height: 220, marginBottom: 24 }, loadingTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' }, loadingSubtitle: { color: COLORS.mint, fontSize: 12, fontWeight: '800', letterSpacing: 3, marginTop: 5 }, loadingIndicator: { marginTop: 24 }, appRoot: { flex: 1 }, lockOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 }, tabBar: { borderTopWidth: 0, backgroundColor: COLORS.card, elevation: 14, shadowColor: COLORS.navy, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } }, tabLabel: { fontSize: 10, fontWeight: '800' }, tabIcon: { fontSize: 19, fontWeight: '800' }, lockScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: COLORS.navyDeep }, lockIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, lockIconText: { color: '#fff', fontSize: 30 }, lockTitle: { color: '#fff', fontSize: 22, fontWeight: '900' }, lockText: { color: '#B8CBD2', textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 20 }, lockButton: { width: '100%' }, lockLogout: { color: '#B8CBD2', fontSize: 13, fontWeight: '700', marginTop: 14, textDecorationLine: 'underline' } });
