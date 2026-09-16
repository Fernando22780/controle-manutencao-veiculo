import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

const STORAGE_KEY = '@controle_manutencao_registros';
const LOCATION_KEY = '@controle_manutencao_localizacao_atual';
const PHOTO_KEY = '@controle_manutencao_comprovante_atual';
const Tab = createBottomTabNavigator();
const COLORS = { navy: '#0f172a', blue: '#2563eb', bg: '#f1f5f9', card: '#ffffff', text: '#172033', muted: '#64748b', border: '#dbe3ef', red: '#dc2626', green: '#16a34a' };

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    unlockApp();
  }, []);

  async function unlockApp() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware && await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setAuthMessage('Este dispositivo não possui biometria configurada.');
        setAuthenticated(true);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear Controle de Manutenção',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });
      if (result.success) setAuthenticated(true);
      else setAuthMessage('Autenticação não realizada. Toque em tentar novamente.');
    } catch (error) {
      setAuthMessage('Não foi possível iniciar a biometria.');
    } finally {
      setCheckingAuth(false);
    }
  }

  if (checkingAuth) return <CenteredMessage text="Verificando biometria..." />;
  if (!authenticated) {
    return (
      <SafeAreaView style={styles.authScreen}>
        <StatusBar style="light" />
        <Text style={styles.authIcon}>🔒</Text>
        <Text style={styles.authTitle}>Aplicativo protegido</Text>
        <Text style={styles.authText}>{authMessage}</Text>
        <PrimaryButton title="Tentar novamente" onPress={() => { setCheckingAuth(true); unlockApp(); }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <TabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: COLORS.blue, tabBarInactiveTintColor: '#475569', tabBarLabelStyle: styles.tabLabel, tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: insets.bottom + 8 }], tabBarHideOnKeyboard: true }}>
      <Tab.Screen name="Início" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 19 }}>⌂</Text> }} />
      <Tab.Screen name="Manutenções" component={MaintenanceScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✓</Text> }} />
      <Tab.Screen name="Localização" component={LocationScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌖</Text> }} />
      <Tab.Screen name="Comprovante" component={ReceiptScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>▣</Text> }} />
    </Tab.Navigator>
  );
}

function HomeScreen() {
  const [count, setCount] = useState(0);
  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then((value) => setCount(value ? JSON.parse(value).length : 0)); }, []);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Text style={styles.eyebrow}>CONTROLE DE MANUTENÇÃO</Text>
      <Text style={styles.title}>Manutenção de veículo</Text>
      <Text style={styles.subtitle}>Registre serviços, localização da oficina e comprovantes em um só lugar.</Text>
      <View style={styles.heroCard}><Text style={styles.heroNumber}>{count}</Text><Text style={styles.heroLabel}>manutenção(ões) registrada(s)</Text></View>
      <View style={styles.infoCard}><Text style={styles.cardTitle}>Como usar</Text><Text style={styles.cardText}>1. Cadastre uma manutenção na aba Manutenções.</Text><Text style={styles.cardText}>2. Consulte a localização atual da oficina.</Text><Text style={styles.cardText}>3. Fotografe o comprovante na aba Comprovante.</Text></View>
    </SafeAreaView>
  );
}

function MaintenanceScreen() {
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRecords(); }, []);
  async function loadRecords() {
    try { const saved = await AsyncStorage.getItem(STORAGE_KEY); setRecords(saved ? JSON.parse(saved) : []); }
    catch { Alert.alert('Erro', 'Não foi possível carregar as manutenções.'); }
    finally { setLoading(false); }
  }
  async function saveRecords(next) {
    setRecords(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { Alert.alert('Erro', 'Não foi possível salvar a manutenção.'); }
  }
  async function addRecord() {
    if (!description.trim() || !date.trim()) { Alert.alert('Atenção', 'Informe a descrição e a data da manutenção.'); return; }
    const savedLocation = await AsyncStorage.getItem(LOCATION_KEY);
    const savedPhoto = await AsyncStorage.getItem(PHOTO_KEY);
    const record = { id: Date.now().toString(), description: description.trim(), date: date.trim(), location: savedLocation ? JSON.parse(savedLocation) : null, photo: savedPhoto || null };
    saveRecords([record, ...records]); setDescription(''); setDate('');
  }
  function removeRecord(id) {
    Alert.alert('Excluir manutenção', 'Deseja realmente excluir este registro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => saveRecords(records.filter((item) => item.id !== id)) }]);
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Manutenções</Text><Text style={styles.subtitle}>Cadastre e acompanhe os serviços realizados.</Text>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.fieldLabel}>SERVIÇO REALIZADO</Text><TextInput style={styles.input} placeholder="Ex.: troca de óleo" placeholderTextColor={COLORS.muted} value={description} onChangeText={setDescription} />
        <Text style={styles.fieldLabel}>DATA DA MANUTENÇÃO</Text><TextInput style={styles.input} placeholder="Ex.: 14/09/2026" placeholderTextColor={COLORS.muted} value={date} onChangeText={setDate} />
        <PrimaryButton title="Adicionar manutenção" onPress={addRecord} />
      </KeyboardAvoidingView>
      {loading ? <CenteredMessage text="Carregando registros..." /> : <FlatList data={records} keyExtractor={(item) => item.id} contentContainerStyle={records.length ? styles.list : styles.emptyList} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyIcon}>✓</Text><Text style={styles.emptyTitle}>Nenhuma manutenção</Text><Text style={styles.emptyText}>Use o formulário acima para registrar o primeiro serviço.</Text></View>} renderItem={({ item }) => <View style={styles.recordCard}><View style={styles.recordAccent} /><View style={{ flex: 1 }}><Text style={styles.recordTitle}>{item.description}</Text><Text style={styles.recordDate}>{item.date}</Text><Text style={styles.badge}>{item.location ? '⌖ Local salvo' : '⌖ Sem localização'}  •  {item.photo ? '▣ Comprovante salvo' : '▣ Sem comprovante'}</Text></View><Pressable onPress={() => removeRecord(item.id)} style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.5 }]}><Text style={styles.deleteText}>Excluir</Text></Pressable></View>} />}
    </SafeAreaView>
  );
}

function LocationScreen() {
  const [coords, setCoords] = useState(null);
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [message, setMessage] = useState('Obtendo localização...');
  const vassouras = { latitude: -22.4063, longitude: -43.6632 };

  async function getLocation() {
    setMessage('Obtendo localização...');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') { setMessage('Permissão de localização negada.'); return; }
    try {
      const current = await Location.getCurrentPositionAsync({});
      setCoords(current.coords);
      await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(current.coords));
      setMessage('Localização atual da oficina');
    } catch { setMessage('Não foi possível obter a localização.'); }
  }

  useEffect(() => { getLocation(); }, []);

  function useWorkshopLocation() {
    const latitude = Number(latitudeInput.replace(',', '.'));
    const longitude = Number(longitudeInput.replace(',', '.'));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      Alert.alert('Localização inválida', 'Informe uma latitude e longitude válidas.'); return;
    }
    const workshop = { latitude, longitude };
    setCoords(workshop); setMessage('Localização informada da oficina');
    AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(workshop));
  }

  function useVassourasLocation() {
    setCoords(vassouras); setLatitudeInput(String(vassouras.latitude)); setLongitudeInput(String(vassouras.longitude));
    setMessage('Universidade de Vassouras — Vassouras/RJ');
    AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(vassouras));
  }

  const region = coords
    ? { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }
    : { latitude: vassouras.latitude, longitude: vassouras.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <SafeAreaView style={styles.locationScreen} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Localização da oficina</Text>
      <Text style={styles.locationMessage}>{message}</Text>
      <View style={styles.mapWrap}>
        <MapView style={styles.map} region={region} mapType="standard" showsUserLocation={Boolean(coords)} showsMyLocationButton={Boolean(coords)} showsCompass showsBuildings showsScale zoomControlEnabled toolbarEnabled loadingEnabled loadingIndicatorColor={COLORS.blue} loadingBackgroundColor="#ffffff">
          {coords && <Marker coordinate={{ latitude: coords.latitude, longitude: coords.longitude }} title="Oficina" description="Local da manutenção" pinColor={COLORS.blue} />}
        </MapView>
      </View>
      {coords && <View style={styles.coordsCard}><Text style={styles.coordText}>Latitude: {coords.latitude.toFixed(6)}</Text><Text style={styles.coordText}>Longitude: {coords.longitude.toFixed(6)}</Text></View>}
      <View style={styles.locationForm}>
        <Text style={styles.fieldLabel}>OU INFORME A LOCALIZAÇÃO DA OFICINA</Text>
        <View style={styles.coordInputs}><TextInput style={styles.coordInput} placeholder="Latitude" keyboardType="numeric" value={latitudeInput} onChangeText={setLatitudeInput} /><TextInput style={styles.coordInput} placeholder="Longitude" keyboardType="numeric" value={longitudeInput} onChangeText={setLongitudeInput} /></View>
        <View style={styles.locationButtons}><Pressable style={styles.secondaryButton} onPress={useVassourasLocation}><Text style={styles.secondaryText}>Usar Vassouras/RJ</Text></Pressable><Pressable style={styles.captureButton} onPress={useWorkshopLocation}><Text style={styles.captureText}>Usar informada</Text></Pressable></View>
      </View>
      <PrimaryButton title="Usar localização atual" onPress={getLocation} />
    </SafeAreaView>
  );
}

function ReceiptScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [facing, setFacing] = useState('back');
  if (!permission) return <CenteredMessage text="Verificando permissão da câmera..." />;
  if (!permission.granted) return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}><Text style={styles.title}>Comprovante</Text><Text style={styles.subtitle}>A câmera é usada para fotografar a nota fiscal ou comprovante.</Text><PrimaryButton title="Permitir câmera" onPress={requestPermission} /></SafeAreaView>;
  async function takePicture() { if (!cameraRef.current) return; const result = await cameraRef.current.takePictureAsync({ quality: 0.8 }); if (result?.uri) { setPhoto(result.uri); await AsyncStorage.setItem(PHOTO_KEY, result.uri); } }
  return <SafeAreaView style={styles.cameraScreen} edges={['top', 'left', 'right']}><Text style={styles.title}>Comprovante</Text>{photo ? <View style={styles.previewWrap}><Image source={{ uri: photo }} style={styles.preview} /><PrimaryButton title="Tirar outra foto" onPress={() => setPhoto(null)} /></View> : <><View style={styles.cameraWrap}><CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="picture" /></View><View style={styles.cameraActions}><Pressable style={styles.secondaryButton} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}><Text style={styles.secondaryText}>Inverter</Text></Pressable><Pressable style={styles.captureButton} onPress={takePicture}><Text style={styles.captureText}>Fotografar</Text></Pressable></View></>}</SafeAreaView>;
}

function PrimaryButton({ title, onPress }) { return <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={onPress}><Text style={styles.primaryText}>{title}</Text></Pressable>; }
function CenteredMessage({ text }) { return <View style={styles.centered}><Text style={styles.centeredText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 }, locationScreen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 }, cameraScreen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 }, tabBar: { height: 78, paddingTop: 6, paddingBottom: 17, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#ffffff', elevation: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5 },
  title: { color: COLORS.navy, fontSize: 28, fontWeight: '800', marginTop: 12 }, subtitle: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 18 }, eyebrow: { color: COLORS.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 14 }, heroCard: { backgroundColor: COLORS.navy, borderRadius: 18, padding: 24, marginTop: 14, marginBottom: 16 }, heroNumber: { color: '#fff', fontSize: 42, fontWeight: '800' }, heroLabel: { color: '#cbd5e1', fontSize: 15, marginTop: 3 }, infoCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border }, cardTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 10 }, cardText: { color: COLORS.muted, fontSize: 14, lineHeight: 25 }, fieldLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 }, input: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 11, height: 50, paddingHorizontal: 14, fontSize: 15, color: COLORS.text, marginBottom: 12 }, coordInputs: { flexDirection: 'row', gap: 8 }, coordInput: { flex: 1, height: 42, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, color: COLORS.text, backgroundColor: '#fff' }, locationForm: { backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: COLORS.border }, locationButtons: { flexDirection: 'row', gap: 8, marginTop: 9 }, primaryButton: { backgroundColor: COLORS.blue, borderRadius: 11, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' }, buttonPressed: { opacity: 0.75 }, list: { paddingTop: 5, paddingBottom: 20 }, emptyList: { flexGrow: 1, justifyContent: 'center' }, emptyState: { alignItems: 'center', marginBottom: 100 }, emptyIcon: { color: COLORS.blue, fontSize: 42, fontWeight: '800' }, emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 8 }, emptyText: { color: COLORS.muted, textAlign: 'center', marginTop: 6, lineHeight: 21 }, recordCard: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 13, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }, recordAccent: { width: 4, alignSelf: 'stretch', borderRadius: 4, backgroundColor: COLORS.blue, marginRight: 11 }, recordTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' }, recordDate: { color: COLORS.muted, fontSize: 13, marginTop: 5 }, badge: { color: COLORS.blue, backgroundColor: '#eff6ff', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5, marginTop: 8, alignSelf: 'flex-start' }, deleteButton: { padding: 8 }, deleteText: { color: COLORS.red, fontSize: 13, fontWeight: '700' }, locationMessage: { color: COLORS.muted, marginTop: 6, marginBottom: 10 }, mapWrap: { flex: 1, minHeight: 200, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }, map: { flex: 1 }, coordsCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 13, marginTop: 10, borderWidth: 1, borderColor: COLORS.border }, coordText: { color: COLORS.text, fontSize: 14, marginVertical: 2 }, cameraWrap: { flex: 1, overflow: 'hidden', borderRadius: 15, backgroundColor: '#111827', marginBottom: 12 }, camera: { flex: 1 }, cameraActions: { flexDirection: 'row', gap: 10 }, secondaryButton: { flex: 1, height: 48, borderRadius: 11, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: COLORS.text, fontWeight: '700' }, captureButton: { flex: 1, height: 48, borderRadius: 11, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' }, captureText: { color: '#fff', fontWeight: '700' }, previewWrap: { flex: 1 }, preview: { flex: 1, width: '100%', resizeMode: 'contain', backgroundColor: '#111827', borderRadius: 15, marginBottom: 12 }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }, centeredText: { color: COLORS.muted, fontSize: 15 }, authScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: COLORS.navy }, authIcon: { fontSize: 42, marginBottom: 15 }, authTitle: { color: '#fff', fontSize: 25, fontWeight: '800' }, authText: { color: '#cbd5e1', textAlign: 'center', lineHeight: 22, marginVertical: 12 }, tabLabel: { fontSize: 11, fontWeight: '600' },
});
