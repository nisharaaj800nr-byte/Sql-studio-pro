import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { QueryHistoryEntry } from '@/contexts/EditorContext';
import { truncateSQL, formatDuration, formatTimestamp } from '@/utils/formatters';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface QueryHistoryItemProps {
  entry: QueryHistoryEntry;
  onPress: () => void;
  onDelete?: () => void;
}

export function QueryHistoryItem({ entry, onPress, onDelete }: QueryHistoryItemProps) {
  const colors = useColors();
  const statusColor = entry.success ? colors.accent : colors.destructive;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: pressed ? colors.muted : colors.card,
          borderColor: colors.border,
          borderLeftColor: statusColor,
        },
      ]}
    >
      <View style={styles.statusRow}>
        <Ionicons
          name={entry.success ? 'checkmark-circle' : 'close-circle'}
          size={13}
          color={statusColor}
        />
        <Text style={[styles.dbName, { color: colors.mutedForeground }]}>{entry.databaseName}</Text>
        <View style={styles.spacer} />
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatTimestamp(entry.timestamp)}
        </Text>
      </View>

      <Text
        style={[styles.sql, { color: colors.foreground, fontFamily: MONO_FONT }]}
        numberOfLines={2}
      >
        {truncateSQL(entry.sql, 120)}
      </Text>

      <View style={styles.footer}>
        {entry.success ? (
          <>
            <View style={styles.metaItem}>
              <Ionicons name="grid-outline" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {entry.rowCount} row{entry.rowCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {formatDuration(entry.executionTime)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={[styles.errorText, { color: colors.destructive }]} numberOfLines={1}>
            {entry.error}
          </Text>
        )}
        <View style={styles.spacer} />
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    marginHorizontal: 16,
    marginVertical: 3,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    padding: 11,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dbName: { fontSize: 12, fontWeight: '500' },
  spacer: { flex: 1 },
  time: { fontSize: 11 },
  sql: { fontSize: 13, lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
  errorText: { fontSize: 11, flex: 1 },
});
