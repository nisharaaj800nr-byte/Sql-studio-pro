import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface InputModalProps {
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

export function InputModal({
  visible,
  title,
  message,
  placeholder,
  defaultValue = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: InputModalProps) {
  const colors = useColors();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      // Auto-focus after modal animation
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible, defaultValue]);

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <Pressable
            style={[
              styles.dialog,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: '#000',
              },
            ]}
            onPress={() => {}} // prevent overlay close on dialog tap
          >
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            {message ? (
              <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
            ) : null}

            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder ?? ''}
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              selectTextOnFocus
            />

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                style={[styles.btn, { borderColor: colors.border }]}
              >
                <Text style={[styles.btnText, { color: colors.mutedForeground }]}>
                  {cancelLabel}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  { backgroundColor: colors.primary, opacity: value.trim() ? 1 : 0.4 },
                ]}
                disabled={!value.trim()}
              >
                <Text style={[styles.btnText, { color: colors.primaryForeground, fontWeight: '700' }]}>
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kav: {
    width: '100%',
    alignItems: 'center',
  },
  dialog: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnText: {
    fontSize: 15,
  },
});
