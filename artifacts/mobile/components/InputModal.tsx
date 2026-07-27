/**
 * InputModal — Premium "Save Query" dialog
 * Decorative gradient/glow elements kept as brand constants.
 * Surface colors (card bg, input bg, text) sourced from useColors().
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

// ── Brand constants (gradient/glow — not surface colors) ───────────────────────
const BORDER_GRAD: [string, string, string] = ['#5B6EFF', '#8B5CF6', '#4B7BFF'];
const PRIMARY     = '#4B7BFF';
const PURPLE      = '#7C5CFF';
const ICON_BG1    = '#3B1F8A';
const ICON_BG2    = '#6B3FD4';
const ICON_GLOW   = '#7C5CFF';

// ── Props ──────────────────────────────────────────────────────────────────────
export interface InputModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function InputModal({
  visible,
  title,
  message,
  placeholder,
  defaultValue = '',
  confirmLabel = 'Save',
  cancelLabel  = 'Cancel',
  onConfirm,
  onCancel,
}: InputModalProps) {
  const c = useColors();
  const [value, setValue]           = useState(defaultValue);
  const [inputFocused, setFocused]  = useState(false);
  const inputRef                    = useRef<TextInput>(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.88);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 140, friction: 12, useNativeDriver: false }),
      ]).start(() => { setTimeout(() => inputRef.current?.focus(), 60); });
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]).start();
    }
  }, [visible, defaultValue]);

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
    setValue('');
  };

  const handleCancel = () => {
    setValue('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
        )}
        {Platform.OS === 'ios' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        )}
      </Animated.View>

      <Pressable style={s.touchDismiss} onPress={handleCancel} />

      <KeyboardAvoidingView style={s.kavWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
        <Animated.View style={[s.dialogWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

          {/* Floating icon with glow */}
          <View style={s.iconRegion}>
            <View style={s.iconGlow3} />
            <View style={s.iconGlow2} />
            <View style={s.iconGlow1} />
            <LinearGradient colors={[ICON_BG1, ICON_BG2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconCircle}>
              <Ionicons name="save-outline" size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Card with gradient border */}
          <LinearGradient colors={BORDER_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardBorderWrap}>
            <Pressable onPress={() => {}} style={[s.card, { backgroundColor: c.card }]}>
              {/* Subtle inner gradient */}
              <LinearGradient
                colors={[c.elevated, c.card]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <Text style={[s.title, { color: c.foreground }]}>{title}</Text>

              {message ? <Text style={[s.message, { color: c.mutedForeground }]}>{message}</Text> : null}

              {/* Text input */}
              <View style={[
                s.inputWrap,
                { borderColor: c.inputBorder, backgroundColor: c.background },
                inputFocused && { borderColor: PRIMARY + 'CC', shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
              ]}>
                {inputFocused && <View style={s.inputGlow} pointerEvents="none" />}
                <TextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={setValue}
                  placeholder={placeholder ?? ''}
                  placeholderTextColor={c.mutedForeground}
                  style={[s.input, { color: c.foreground }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  selectTextOnFocus
                />
              </View>

              {/* Buttons */}
              <View style={s.btnRow}>
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [s.btn, s.btnCancel, { backgroundColor: c.muted, borderColor: c.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[s.btnCancelText, { color: c.foreground }]}>{cancelLabel}</Text>
                </Pressable>

                <Pressable onPress={handleConfirm} disabled={!value.trim()} style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}>
                  <LinearGradient colors={[PRIMARY, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGradientInner}>
                    <Text style={s.btnSaveText}>{confirmLabel}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const DIALOG_W = 320;

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  touchDismiss: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  kavWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'box-none' as any },
  dialogWrap: { width: DIALOG_W, alignItems: 'center' },

  // Floating icon
  iconRegion: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: -28, zIndex: 10 },
  iconGlow3: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: ICON_GLOW, opacity: 0.08 },
  iconGlow2: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: ICON_GLOW, opacity: 0.14 },
  iconGlow1: { position: 'absolute', width: 50, height: 50, borderRadius: 25, backgroundColor: ICON_GLOW, opacity: 0.22 },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ICON_GLOW, shadowOpacity: 0.7, shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },

  // Gradient border card
  cardBorderWrap: {
    width: '100%', borderRadius: 22, padding: 1.5,
    shadowColor: PRIMARY, shadowOpacity: 0.35, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }, elevation: 16,
  },
  card: {
    borderRadius: 21, overflow: 'hidden',
    paddingTop: 44, paddingHorizontal: 24, paddingBottom: 24,
    gap: 14, alignItems: 'center',
  },

  // Typography
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  message: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: -4 },

  // Input
  inputWrap: { width: '100%', borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  inputGlow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 16, backgroundColor: PRIMARY, opacity: 0.08 },
  input: { paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, width: '100%' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 2 },
  btn: { flex: 1, borderRadius: 12, overflow: 'hidden', minHeight: 46 },
  btnCancel: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnGradientInner: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 12 },
  btnCancelText: { fontSize: 15, fontWeight: '600' },
  btnSaveText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
