/**
 * InputModal — Premium "Save Query" dialog
 * 100% visual parity with reference design:
 *   • Blurred / dimmed backdrop with editor visible behind
 *   • Glowing gradient border card (LinearGradient wrapper technique)
 *   • Floating purple icon with halo glow
 *   • Glowing text field
 *   • Cancel (dark) + Save (blue→purple gradient) buttons
 *   • Scale + fade entrance / exit animation
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

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG_OVERLAY  = 'rgba(0,0,0,0.72)';
const CARD_BG     = '#0E1422';
const CARD_BG2    = '#131929';
const BORDER_GRAD: [string, string, string] = ['#5B6EFF', '#8B5CF6', '#4B7BFF'];
const PRIMARY     = '#4B7BFF';
const PURPLE      = '#7C5CFF';
const ICON_BG1    = '#3B1F8A';
const ICON_BG2    = '#6B3FD4';
const ICON_GLOW   = '#7C5CFF';
const FG          = '#E6EDF3';
const MUTED_FG    = '#6B7A96';
const INPUT_BG    = '#0A0E18';
const INPUT_BDR   = 'rgba(255,255,255,0.18)';
const CANCEL_BG   = '#141C2E';
const CANCEL_BDR  = 'rgba(255,255,255,0.1)';

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
  const [value, setValue]           = useState(defaultValue);
  const [inputFocused, setFocused]  = useState(false);
  const inputRef                    = useRef<TextInput>(null);

  // Animation values
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  // ── Animate in / out ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      // Reset before animating in
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.88);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 140,
          friction: 12,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // Auto-focus after animation
        setTimeout(() => inputRef.current?.focus(), 60);
      });
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={18}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BG_OVERLAY }]} />
        )}
        {Platform.OS === 'ios' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        )}
      </Animated.View>

      {/* Tap-outside to close */}
      <Pressable style={s.touchDismiss} onPress={handleCancel} />

      {/* Keyboard-aware wrapper */}
      <KeyboardAvoidingView
        style={s.kavWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        {/* Animated dialog */}
        <Animated.View
          style={[
            s.dialogWrap,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* ── Floating icon with glow ── */}
          <View style={s.iconRegion}>
            {/* Outer glow rings */}
            <View style={s.iconGlow3} />
            <View style={s.iconGlow2} />
            <View style={s.iconGlow1} />

            {/* Icon circle */}
            <LinearGradient
              colors={[ICON_BG1, ICON_BG2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.iconCircle}
            >
              <Ionicons name="save-outline" size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* ── Card with gradient border ── */}
          <LinearGradient
            colors={BORDER_GRAD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cardBorderWrap}
          >
            {/* Inner card */}
            <Pressable onPress={() => {}} style={s.card}>
              {/* Subtle inner gradient */}
              <LinearGradient
                colors={[CARD_BG2, CARD_BG]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Title */}
              <Text style={s.title}>{title}</Text>

              {/* Message / subtitle */}
              {message ? (
                <Text style={s.message}>{message}</Text>
              ) : null}

              {/* ── Text input with glow border ── */}
              <View
                style={[
                  s.inputWrap,
                  inputFocused && s.inputWrapFocused,
                ]}
              >
                {inputFocused && (
                  <View style={s.inputGlow} pointerEvents="none" />
                )}
                <TextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={setValue}
                  placeholder={placeholder ?? ''}
                  placeholderTextColor={MUTED_FG}
                  style={s.input}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  selectTextOnFocus
                />
              </View>

              {/* ── Buttons ── */}
              <View style={s.btnRow}>
                {/* Cancel */}
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [s.btn, s.btnCancel, pressed && { opacity: 0.7 }]}
                >
                  <Text style={s.btnCancelText}>{cancelLabel}</Text>
                </Pressable>

                {/* Save — gradient */}
                <Pressable
                  onPress={handleConfirm}
                  disabled={!value.trim()}
                  style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient
                    colors={[PRIMARY, PURPLE]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.btnGradientInner}
                  >
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
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  touchDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  // KAV / centering
  kavWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'box-none' as any,
  },

  // Dialog container (includes floating icon + card)
  dialogWrap: {
    width: DIALOG_W,
    alignItems: 'center',
    // No overflow:hidden so icon glow can overflow above card
  },

  // ── Floating icon ──────────────────────────────────────────────────────────
  iconRegion: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -28,      // overlaps into the card
    zIndex: 10,
  },
  iconGlow3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ICON_GLOW,
    opacity: 0.08,
  },
  iconGlow2: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ICON_GLOW,
    opacity: 0.14,
  },
  iconGlow1: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ICON_GLOW,
    opacity: 0.22,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ICON_GLOW,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },

  // ── Gradient border card ───────────────────────────────────────────────────
  cardBorderWrap: {
    width: '100%',
    borderRadius: 22,
    padding: 1.5,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  card: {
    borderRadius: 21,
    overflow: 'hidden',
    paddingTop: 44,       // room for floating icon overlap
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
    alignItems: 'center',
  },

  // ── Typography ─────────────────────────────────────────────────────────────
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: FG,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: MUTED_FG,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: -4,
  },

  // ── Input ──────────────────────────────────────────────────────────────────
  inputWrap: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INPUT_BDR,
    backgroundColor: INPUT_BG,
    overflow: 'hidden',
    position: 'relative',
  },
  inputWrapFocused: {
    borderColor: PRIMARY + 'CC',
    shadowColor: PRIMARY,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  inputGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    opacity: 0.08,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: FG,
    width: '100%',
  },

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 2,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 46,
  },
  btnCancel: {
    backgroundColor: CANCEL_BG,
    borderWidth: 1,
    borderColor: CANCEL_BDR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGradientInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 12,
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: FG,
  },
  btnSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
