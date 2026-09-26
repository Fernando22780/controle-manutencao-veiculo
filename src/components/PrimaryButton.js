import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../theme';

export default function PrimaryButton({ title, onPress, variant = 'primary', disabled = false, compact = false }) {
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        isSecondary ? styles.secondary : isGhost ? styles.ghost : styles.primary,
        (pressed || disabled) && { opacity: 0.72, transform: [{ scale: 0.985 }] },
      ]}
    >
      <Text style={[styles.text, isSecondary && styles.secondaryText, isGhost && styles.ghostText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 52, borderRadius: RADIUS.control, alignItems: 'center', justifyContent: 'center', marginBottom: 12, paddingHorizontal: 16 },
  compact: { height: 44, marginBottom: 0 },
  primary: { backgroundColor: COLORS.blue, ...SHADOW },
  secondary: { backgroundColor: COLORS.paleBlue, borderWidth: 1, borderColor: '#C8E3E1' },
  ghost: { backgroundColor: 'transparent' },
  text: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryText: { color: COLORS.blue },
  ghostText: { color: COLORS.muted },
});
