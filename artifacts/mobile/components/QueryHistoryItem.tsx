import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
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
          backgroundColor: pressed ? colors.secondary : colors.card,
          borderColor: colors.border,
          borderLeftColor: statusColor,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <MaterialIcons
            name={entry.success ? 'check-circle' : 'error'}
            size={14}
            color={statusColor}
          />
          <Text style={[styles.dbName, { color: colors.mutedForeground }]}>{entry.databaseName}</Text>
          <View style={styles.spacer} />
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {formatTimestamp(entry.timestamp)}
          </Text>
        </View>
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
              <MaterialIcons name="table-rows" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {entry.rowCount} row{entry.rowCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="timer" size={11} color={colors.mutedForeground} />
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
            <MaterialCommunityIcons name="delete-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    gap: 6,
  },
  header: {},
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
