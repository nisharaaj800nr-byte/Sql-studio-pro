/**
 * ColorPickerModal — Phase 3.3 (CSS color picker)
 * Simple preset palette + hex input. Inserts the chosen color at cursor.
 */
import React, { useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

const PRESETS: string[] = [
  // Reds
  '#ef4444', '#dc2626', '#b91c1c',
  // Oranges
  '#f97316', '#ea580c', '#fb923c',
  // Yellows
  '#eab308', '#ca8a04', '#fde047',
  // Greens
  '#22c55e', '#16a34a', '#4ade80',
  // Teals
  '#14b8a6', '#0d9488', '#2dd4bf',
  // Blues
  '#3b82f6', '#2563eb', '#60a5fa',
  // Indigos
  '#6366f1', '#4f46e5', '#818cf8',
  // Purples
  '#a855f7', '#9333ea', '#c084fc',
  // Pinks
  '#ec4899', '#db2777', '#f472b6',
  // Grays
  '#6b7280', '#374151', '#111827',
  // White / Black
  '#ffffff', '#000000',
  // Transparent
  'transparent',
];

function isValidHex(h: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h.trim());
}

interface ColorPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (color: string) => void;
}

export function ColorPickerModal({ visible, onClose, onPick }: ColorPickerModalProps) {
  const colors = useColors();
  const [hexInput, setHexInput] = useState('');
  const [selected, setSelected] = useState('');

  const handlePreset = (color: string) => {
    setSelected(color);
    setHexInput(color === 'transparent' ? 'transparent' : color);
  };

  const handleInsert = () => {
    const val = hexInput.trim() || selected;
    if (!val) return;
    if (val === 'transparent' || isValidHex(val)) {
      onPick(val);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <MaterialIcons name="palette" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Color Picker</Text>
          <Pressable onPress={onClose} hitSlop={8} style={{ marginLeft: 'auto' }}>
            <MaterialIcons name="close" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Preview swatch */}
        <View style={[styles.previewRow, { borderBottomColor: colors.border }]}>
          <View style={[
            styles.swatch,
            { backgroundColor: selected || '#ffffff', borderColor: colors.border },
            selected === 'transparent' && styles.transparent,
          ]} />
          <Text style={[styles.swatchLabel, { color: colors.mutedForeground }]}>
            {selected || 'Pick a color…'}
          </Text>
        </View>

        {/* Preset grid */}
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {PRESETS.map(color => (
            <Pressable
              key={color}
              onPress={() => handlePreset(color)}
              style={[
                styles.presetSwatch,
                { backgroundColor: color === 'transparent' ? '#fff' : color, borderColor: colors.border },
                color === 'transparent' && styles.transparent,
                selected === color && { borderColor: colors.primary, borderWidth: 2.5 },
              ]}
            >
              {color === 'transparent' && (
                <Text style={{ fontSize: 9, color: colors.mutedForeground }}>none</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Hex input */}
        <View style={[styles.hexRow, { borderTopColor: colors.border }]}>
          <TextInput
            value={hexInput}
            onChangeText={setHexInput}
            placeholder="#2563eb or transparent"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.hexInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: isValidHex(hexInput) || hexInput === 'transparent' ? colors.accent : colors.border }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            onPress={handleInsert}
            style={[styles.insertBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.insertLabel, { color: colors.primaryForeground }]}>Insert</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 32, maxHeight: '70%' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderBottomWidth: 1 },
  title:        { fontSize: 16, fontWeight: '700' },
  previewRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  swatch:       { width: 36, height: 36, borderRadius: 8, borderWidth: 1 },
  swatchLabel:  { fontSize: 14, fontFamily: 'monospace' },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  presetSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  transparent:  { opacity: 0.7 },
  hexRow:       { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1 },
  hexInput:     { flex: 1, borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontFamily: 'monospace' },
  insertBtn:    { borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  insertLabel:  { fontWeight: '700', fontSize: 14 },
});
