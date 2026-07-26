/**
 * ConsolePanel — Phase 3.4
 * Displays JS console.log / warn / error output captured from WebPreview.
 */
import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { ConsoleEntry } from '@/contexts/CodeContext';

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  onClear: () => void;
}

const TYPE_CONFIG = {
  log:   { icon: 'chevron-right' as const, color: (c: ReturnType<typeof useColors>) => c.foreground },
  info:  { icon: 'info-outline'  as const, color: (c: ReturnType<typeof useColors>) => c.primary    },
  warn:  { icon: 'warning-amber' as const, color: (c: ReturnType<typeof useColors>) => c.sqlString  },
  error: { icon: 'error-outline' as const, color: (c: ReturnType<typeof useColors>) => c.destructive },
};

export function ConsolePanel({ entries, onClear }: ConsolePanelProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (entries.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [entries.length]);

  const errorCount = entries.filter(e => e.type === 'error').length;
  const warnCount  = entries.filter(e => e.type === 'warn').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <MaterialIcons name="terminal" size={14} color={colors.primary} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Console</Text>
        {errorCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
            <Text style={styles.badgeText}>{errorCount}</Text>
          </View>
        )}
        {warnCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.sqlString }]}>
            <Text style={styles.badgeText}>{warnCount}</Text>
          </View>
        )}
        <Pressable onPress={onClear} style={styles.clearBtn} hitSlop={8}>
          <MaterialIcons name="delete-sweep" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Entries */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={entries.length === 0 ? styles.emptyContent : styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="terminal" size={24} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No output yet</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Use console.log() in your JS code
            </Text>
          </View>
        ) : (
          entries.map(entry => <ConsoleRow key={entry.id} entry={entry} colors={colors} />)
        )}
      </ScrollView>
    </View>
  );
}

function ConsoleRow({ entry, colors }: { entry: ConsoleEntry; colors: ReturnType<typeof useColors> }) {
  const cfg   = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.log;
  const color = cfg.color(colors);
  const text  = entry.args.join(' ');
  const isMultiline = text.includes('\n');

  return (
    <View style={[styles.row, { borderBottomColor: colors.border + '60', backgroundColor: entry.type === 'error' ? colors.destructive + '0A' : entry.type === 'warn' ? colors.sqlString + '0A' : 'transparent' }]}>
      <MaterialIcons name={cfg.icon} size={13} color={color} style={styles.rowIcon} />
      <Text
        style={[styles.rowText, { color, fontFamily: 'monospace' }]}
        selectable
        numberOfLines={isMultiline ? undefined : 3}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, overflow: 'hidden', borderTopWidth: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1, gap: 6 },
  headerTitle:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  badge:        { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  badgeText:    { fontSize: 10, fontWeight: '700', color: '#fff' },
  clearBtn:     { marginLeft: 'auto', padding: 2 },
  scroll:       { flex: 1 },
  scrollContent:{ paddingBottom: 8 },
  emptyContent: { flex: 1 },
  emptyState:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 20 },
  emptyText:    { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  emptyHint:    { fontSize: 11, opacity: 0.5 },
  row:          { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  rowIcon:      { marginTop: 1, flexShrink: 0 },
  rowText:      { flex: 1, fontSize: 11.5, lineHeight: 17 },
});
