import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { COLORS } from '../theme';

const HANDLE_PAD = 28; // metade da área de toque de cada canto
const MIN_FRAME = 80;
const OUTPUT_SIZE = 800;

/**
 * Editor de foto de perfil (estilo WhatsApp):
 *  1) Mostra a foto escolhida em prévia circular.
 *  2) "Recortar" (opcional) abre o ajuste com arrastar + pinça.
 *  3) "Concluir" salva a foto (com ou sem recorte).
 */
export default function PhotoEditor({ visible, uri, saving = false, onCancel, onConfirm }) {
  const [mode, setMode] = useState('preview'); // 'preview' | 'crop'
  const [workingUri, setWorkingUri] = useState(uri);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setMode('preview'); setWorkingUri(uri); setProcessing(false); setError(''); }
  }, [visible, uri]);

  if (!visible || !uri) return null;

  return <Modal visible animationType="slide" onRequestClose={mode === 'crop' ? () => setMode('preview') : onCancel} statusBarTranslucent>
    {mode === 'preview'
      ? <PreviewStep uri={workingUri} saving={saving} error={error} onCancel={onCancel} onCrop={() => { setError(''); setMode('crop'); }} onConfirm={() => onConfirm?.(workingUri)} />
      : <CropStep
          uri={workingUri}
          processing={processing}
          onBack={() => setMode('preview')}
          onDone={async (cropRect) => {
            setProcessing(true); setError('');
            try {
              const ctx = ImageManipulator.manipulate(workingUri);
              ctx.crop(cropRect);
              if (cropRect.width > OUTPUT_SIZE) ctx.resize({ width: OUTPUT_SIZE });
              const rendered = await ctx.renderAsync();
              const saved = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
              setWorkingUri(saved.uri);
              setMode('preview');
              onConfirm?.(saved.uri);
            } catch (e) {
              console.warn('Falha ao recortar a foto:', e);
              setError('Não foi possível recortar. Você ainda pode concluir com a foto original.');
              setMode('preview');
            } finally { setProcessing(false); }
          }}
        />}
  </Modal>;
}

function PreviewStep({ uri, saving, error, onCancel, onCrop, onConfirm }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 48, 340);
  return <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
    <View style={styles.header}>
      <Pressable onPress={onCancel} disabled={saving} hitSlop={12} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Cancelar"><MaterialCommunityIcons name="close" size={26} color="#fff" /></Pressable>
      <Text style={styles.headerTitle}>Foto de perfil</Text>
      <View style={styles.headerBtn} />
    </View>
    <View style={styles.previewArea}>
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1b1b1b' }} resizeMode="cover" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
    <View style={styles.footer}>
      <Pressable onPress={onCrop} disabled={saving} style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed, saving && styles.disabled]} accessibilityRole="button">
        <MaterialCommunityIcons name="crop" size={20} color="#fff" /><Text style={styles.btnText}>Recortar</Text>
      </Pressable>
      <Pressable onPress={onConfirm} disabled={saving} style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed, saving && styles.disabled]} accessibilityRole="button">
        {saving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="check" size={20} color="#fff" />}
        <Text style={styles.btnText}>{saving ? 'Salvando…' : 'Concluir'}</Text>
      </Pressable>
    </View>
  </View>;
}

function CropStep({ uri, processing, onBack, onDone }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const stageH = Math.max(300, height - insets.top - insets.bottom - 150);
  const [nat, setNat] = useState(null);
  const [frame, setFrame] = useState(null); // moldura quadrada: { x, y, s } em coordenadas do palco
  const S = useRef({ frame: null, img: null });

  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => { if (alive) setNat({ w, h }); }, () => { if (alive) setNat({ w: 400, h: 400 }); });
    return () => { alive = false; };
  }, [uri]);

  // A foto aparece inteira (contain), com uma margem para os cantos poderem ser tocados nas bordas.
  const img = useMemo(() => {
    if (!nat) return null;
    const sc = Math.min((width - 2 * HANDLE_PAD) / nat.w, (stageH - 2 * HANDLE_PAD) / nat.h);
    const w = nat.w * sc, h = nat.h * sc;
    return { sc, w, h, left: (width - w) / 2, top: (stageH - h) / 2 };
  }, [nat, width, stageH]);
  S.current.img = img;

  useEffect(() => {
    if (!img) return;
    const size = Math.min(img.w, img.h);
    const f = { x: img.left + (img.w - size) / 2, y: img.top + (img.h - size) / 2, s: size };
    S.current.frame = f;
    setFrame(f);
  }, [img]);

  function setF(f) { S.current.frame = f; setFrame(f); }

  const responders = useMemo(() => {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const make = (kind) => {
      const g = { mode: null, start: null };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { g.mode = null; g.start = { ...S.current.frame }; },
        onPanResponderMove: (evt, gs) => {
          const im = S.current.img;
          if (!im || !g.start) return;
          const st = g.start;
          if (kind === 'body') {
            const touches = evt.nativeEvent.touches || [];
            const maxS = Math.min(im.w, im.h);
            if (touches.length >= 2) {
              const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
              if (g.mode !== 'pinch') { g.mode = 'pinch'; g.d0 = dist || 1; g.base = { ...S.current.frame }; return; }
              const s = clamp(g.base.s * (dist / g.d0), MIN_FRAME, maxS);
              const cx = g.base.x + g.base.s / 2, cy = g.base.y + g.base.s / 2;
              setF({ s, x: clamp(cx - s / 2, im.left, im.left + im.w - s), y: clamp(cy - s / 2, im.top, im.top + im.h - s) });
            } else {
              if (g.mode !== 'pan') { g.mode = 'pan'; g.sx = gs.dx; g.sy = gs.dy; g.base = { ...S.current.frame }; return; }
              const b = g.base;
              setF({ s: b.s, x: clamp(b.x + gs.dx - g.sx, im.left, im.left + im.w - b.s), y: clamp(b.y + gs.dy - g.sy, im.top, im.top + im.h - b.s) });
            }
            return;
          }
          // cantos: o canto oposto fica fixo e a moldura continua quadrada
          const right = kind === 'tr' || kind === 'br';
          const bottom = kind === 'bl' || kind === 'br';
          const sx = right ? 1 : -1, sy = bottom ? 1 : -1;
          const ax = right ? st.x : st.x + st.s, ay = bottom ? st.y : st.y + st.s;
          const cx = (right ? st.x + st.s : st.x) + gs.dx, cy = (bottom ? st.y + st.s : st.y) + gs.dy;
          const maxS = Math.min(sx > 0 ? im.left + im.w - ax : ax - im.left, sy > 0 ? im.top + im.h - ay : ay - im.top);
          const s = Math.min(maxS, Math.max(MIN_FRAME, ((cx - ax) * sx + (cy - ay) * sy) / 2));
          setF({ s, x: sx > 0 ? ax : ax - s, y: sy > 0 ? ay : ay - s });
        },
        onPanResponderRelease: () => { g.mode = null; },
        onPanResponderTerminate: () => { g.mode = null; },
      });
    };
    return { body: make('body'), tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') };
  }, []);

  function finish() {
    if (!nat || !img || !frame || processing) return;
    let size = Math.min(Math.floor(frame.s / img.sc), nat.w, nat.h);
    const originX = Math.max(0, Math.min(nat.w - size, Math.floor((frame.x - img.left) / img.sc)));
    const originY = Math.max(0, Math.min(nat.h - size, Math.floor((frame.y - img.top) / img.sc)));
    onDone({ originX, originY, width: size, height: size });
  }

  const ready = Boolean(img && frame);
  const corners = frame ? [
    ['tl', frame.x, frame.y], ['tr', frame.x + frame.s, frame.y],
    ['bl', frame.x, frame.y + frame.s], ['br', frame.x + frame.s, frame.y + frame.s],
  ] : [];

  return <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
    <View style={styles.header}>
      <Pressable onPress={onBack} disabled={processing} hitSlop={12} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Voltar"><MaterialCommunityIcons name="arrow-left" size={26} color="#fff" /></Pressable>
      <Text style={styles.headerTitle}>Recortar</Text>
      <View style={styles.headerBtn} />
    </View>

    <View style={{ width, height: stageH, alignSelf: 'center', backgroundColor: '#000' }}>
      {ready ? <>
        <Image source={{ uri }} resizeMode="stretch" style={{ position: 'absolute', left: img.left, top: img.top, width: img.w, height: img.h }} />
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.mask, { left: img.left, top: img.top, width: img.w, height: frame.y - img.top }]} />
          <View style={[styles.mask, { left: img.left, top: frame.y + frame.s, width: img.w, height: img.top + img.h - frame.y - frame.s }]} />
          <View style={[styles.mask, { left: img.left, top: frame.y, width: frame.x - img.left, height: frame.s }]} />
          <View style={[styles.mask, { left: frame.x + frame.s, top: frame.y, width: img.left + img.w - frame.x - frame.s, height: frame.s }]} />
          <View style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.s, height: frame.s, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' }} />
          <View style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.s, height: frame.s, borderRadius: frame.s / 2, borderWidth: 2, borderColor: '#fff' }} />
        </View>
        <View {...responders.body.panHandlers} style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.s, height: frame.s }} />
        {corners.map(([k, cx, cy]) => <View key={k} {...responders[k].panHandlers} style={{ position: 'absolute', left: cx - HANDLE_PAD, top: cy - HANDLE_PAD, width: HANDLE_PAD * 2, height: HANDLE_PAD * 2 }}>
          <View pointerEvents="none" style={[styles.bracket, BRACKETS[k]]} />
        </View>)}
      </> : <ActivityIndicator color="#fff" style={StyleSheet.absoluteFill} />}
    </View>

    <Text style={styles.hint}>Arraste os cantos para ajustar o tamanho{'\n'}Toque dentro da área e arraste para mover</Text>

    <View style={styles.footer}>
      <Pressable onPress={onBack} disabled={processing} style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed, processing && styles.disabled]} accessibilityRole="button"><Text style={styles.btnText}>Cancelar</Text></Pressable>
      <Pressable onPress={finish} disabled={processing || !ready} style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed, (processing || !ready) && styles.disabled]} accessibilityRole="button">
        {processing ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="check" size={20} color="#fff" />}
        <Text style={styles.btnText}>{processing ? 'Salvando…' : 'Concluir'}</Text>
      </Pressable>
    </View>
  </View>;
}

const BRACKET = 26, BRACKET_W = 4;
const BRACKETS = {
  tl: { left: HANDLE_PAD, top: HANDLE_PAD, borderTopWidth: BRACKET_W, borderLeftWidth: BRACKET_W },
  tr: { left: HANDLE_PAD - BRACKET, top: HANDLE_PAD, borderTopWidth: BRACKET_W, borderRightWidth: BRACKET_W },
  bl: { left: HANDLE_PAD, top: HANDLE_PAD - BRACKET, borderBottomWidth: BRACKET_W, borderLeftWidth: BRACKET_W },
  br: { left: HANDLE_PAD - BRACKET, top: HANDLE_PAD - BRACKET, borderBottomWidth: BRACKET_W, borderRightWidth: BRACKET_W },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 44 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  error: { color: '#FFB4A9', fontSize: 13, textAlign: 'center', marginTop: 18, lineHeight: 18 },
  hint: { color: '#cfcfcf', fontSize: 12, textAlign: 'center', marginTop: 10 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, marginTop: 'auto' },
  btn: { flex: 1, height: 52, borderRadius: 26, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.16)' },
  btnPrimary: { backgroundColor: COLORS.green },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
  bracket: { position: 'absolute', width: 26, height: 26, borderColor: '#fff' },
  mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.62)' },
});
