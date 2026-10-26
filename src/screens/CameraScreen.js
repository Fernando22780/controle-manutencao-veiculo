import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import { clearStagingPhoto, getRecords, getStagingPhoto, setStagingPhoto } from '../storage';

export default function CameraScreen({ navigation }) {
  const [photo, setPhoto] = useState(null);
  const [records, setRecords] = useState([]);
  useEffect(() => { getStagingPhoto().then(setPhoto); }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    getRecords().then((items) => { if (active) setRecords(items); });
    getStagingPhoto().then((saved) => { if (active) setPhoto(saved); });
    return () => { active = false; };
  }, []));

  async function removeStagedPhoto() { setPhoto(null); await clearStagingPhoto(); }
  function openRecord(record) { navigation.getParent()?.navigate('RecordDetail', { record }); }
  const saved = records.filter((item) => item.photo);

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <FlatList
      data={saved}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <View style={styles.titleRow}><View><Text style={styles.kicker}>HISTÓRICO DO VEÍCULO</Text><Text style={styles.title}>Comprovantes</Text></View><View style={styles.titleIcon}><MaterialCommunityIcons name="receipt-text-outline" size={25} color={COLORS.blue} /></View></View>
        <Text style={styles.subtitle}>Cada comprovante está ligado à manutenção em que foi guardado. Toque num cartão para abrir o registo completo.</Text>
        {photo ? <View style={styles.stagingCard}><View style={styles.stagingHeading}><MaterialCommunityIcons name="image-check-outline" size={20} color={COLORS.green} /><Text style={styles.savedText}>Foto pronta para a próxima manutenção</Text></View><Image source={{ uri: photo }} style={styles.stagingImage} /><PrimaryButton title="Remover foto provisória" variant="secondary" onPress={removeStagedPhoto} /></View> : null}
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Comprovantes guardados</Text><Text style={styles.count}>{saved.length}</Text></View>
      </>}
      ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><MaterialCommunityIcons name="receipt-text-remove-outline" size={28} color={COLORS.blue} /></View><Text style={styles.emptyTitle}>Ainda não há comprovantes</Text><Text style={styles.emptyText}>As fotos vão aparecer aqui depois de guardar uma manutenção. A partir daqui também pode abrir cada registo.</Text></View>}
      renderItem={({ item }) => <Pressable onPress={() => openRecord(item)} style={({ pressed }) => [styles.savedCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Abrir registo: ${item.description}`}>
        <Image source={{ uri: item.photo }} style={styles.thumb} />
        <View style={styles.savedBody}><Text style={styles.savedTitle} numberOfLines={1}>{item.description}</Text><Text style={styles.savedMeta} numberOfLines={1}>{item.vehicle || 'Veículo não informado'} · {item.date}</Text><View style={styles.openHint}><MaterialCommunityIcons name="open-in-new" size={14} color={COLORS.blue} /><Text style={styles.openText}>Abrir registo</Text></View></View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.muted} />
      </Pressable>}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 20, paddingBottom: 35 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, kicker: { color: COLORS.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { color: COLORS.text, fontSize: 28, fontWeight: '900', marginTop: 4 }, titleIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paleBlue }, subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 17 },
  stagingCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.card, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: COLORS.blue, ...SHADOW }, stagingHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 }, stagingImage: { width: '100%', height: 180, borderRadius: 12, resizeMode: 'contain', backgroundColor: '#10202A' }, savedText: { color: COLORS.green, fontWeight: '800', fontSize: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' }, count: { color: COLORS.blue, fontSize: 12, fontWeight: '900', backgroundColor: COLORS.paleBlue, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  savedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 15, padding: 10, borderWidth: 1, borderColor: COLORS.border, marginBottom: 9, ...SHADOW }, pressed: { opacity: 0.75 }, thumb: { width: 68, height: 68, borderRadius: 12, backgroundColor: '#10202A', marginRight: 11 }, savedBody: { flex: 1 }, savedTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' }, savedMeta: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, openHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }, openText: { color: COLORS.blue, fontSize: 10, fontWeight: '900' },
  empty: { backgroundColor: COLORS.card, borderRadius: 17, padding: 23, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }, emptyIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paleBlue }, emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900', marginTop: 10 }, emptyText: { color: COLORS.muted, textAlign: 'center', lineHeight: 19, fontSize: 12, marginTop: 5 },
});
