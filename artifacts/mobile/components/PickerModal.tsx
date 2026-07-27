/**
 * In-app picker modal — replaces Alert.alert pickers that don't work in iframes.
 * Works on web, iOS, and Android.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

interface PickerOption<T = any> {
  label: string;
  value: T;
  desc?: string;
}

interface PickerModalProps<T = any> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: PickerOption<T>[];
  current: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  danger?: boolean;
}

export function PickerModal<T>({
  visible,
  title,
  subtitle,
  options,
  current,
  onSelect,
  onClose,
  danger = false,
}: PickerModalProps<T>) {
  const colors = useColors();

  const handleSelect = (value: T) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: pressed ? colors.muted : 'transparent' },
                ]}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Options */}
            <ScrollView
              style={styles.optionsList}
              contentContainerStyle={styles.optionsContent}
              showsVerticalScrollIndicator={false}
            >
              {options.map((opt, i) => {
                const isSelected = opt.value === current;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => handleSelect(opt.value)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: isSelected
                          ? (danger ? '#F85149' : '#2563EB') + '18'
                          : pressed
                          ? colors.muted
                          : 'transparent',
                        borderBottomColor: colors.border,
                        borderBottomWidth: i < options.length - 1 ? StyleSheet.hairlineWidth : 0,
                      },
                    ]}
                  >
                    <View style={styles.optionBody}>
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color: isSelected
                              ? danger
                                ? '#F85149'
                                : '#2563EB'
                              : colors.foreground,
                            fontWeight: isSelected ? '700' : '400',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {opt.desc ? (
                        <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                          {opt.desc}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={danger ? '#F85149' : '#2563EB'}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Cancel */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancelBtn,
                {
                  backgroundColor: pressed ? colors.muted : colors.background,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Confirm dialog (replaces Alert for destructive actions)
interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const colors = useColors();

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={[styles.confirmSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground, marginBottom: 8 }]}>{title}</Text>
            <Text style={[styles.confirmMsg, { color: colors.mutedForeground }]}>{message}</Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: pressed ? colors.muted : colors.muted, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.confirmBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  {
                    backgroundColor: danger
                      ? pressed ? '#C73E3A' : '#F85149'
                      : pressed ? '#1D4ED8' : '#2563EB',
                    borderColor: 'transparent',
                  },
                ]}
              >
                <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>{confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: 320,
    maxHeight: 480,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: { maxHeight: 320 },
  optionsContent: {},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  optionBody: { flex: 1 },
  optionLabel: { fontSize: 15 },
  optionDesc: { fontSize: 12, marginTop: 2 },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelText: { fontSize: 15, fontWeight: '500' },

  // Confirm dialog
  confirmSheet: {
    width: 300,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  confirmMsg: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '600' },
});
