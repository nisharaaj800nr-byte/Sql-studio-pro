import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { QueryHistoryEntry } from '@/contexts/EditorContext';
import { truncateSQL, formatDuration, formatTimestamp } from '@/utils/formatters';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function getSQLType(sql: string): { label: string; color: string } {
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) return { label: 'SELECT', color: '#58A6FF' };
  if (upper.startsWith('INSERT')) return { label: 'INSERT', color: '#3FB950' };
  if (upper.startsWith('UPDATE')) return { label: 'UPDATE', color: '#F0A000' };
  if (upper.startsWith('DELETE')) return { label: 'DELETE', color: '#F85149' };
  if (upper.startsWith('CREATE')) return { label: 'CREATE', color: '#D2A8FF' };
  if (upper.startsWith('DROP')) return { label: 'DROP', color: '#F85149' };
  if (upper.startsWith('ALTER')) return { label: 'ALTER', color: '#FFA657' };
  if (upper.startsWith('PRAGMA')) return { label: 'PRAGMA', color: '#79C0FF' };
  if (upper.startsWith('EXPLAIN')) return { label: 'EXPLAIN', color: '#79C0FF' };
  if (upper.startsWith('BEGIN') || upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
    return { label: 'TX', color: '#E3B341' };
  }
  return { label: 'SQL', color: '#8B949E' };
}

interface QueryHistoryItemProps {
  entry: QueryHistoryEntry;
  onPress: () => void;
  onDelete?: () => void;
}

export function QueryHistoryItem({ entry, onPress, onDelete }: QueryHistoryItemProps) {
  const colors = useColors();
  const statusColor = entry.success ? colors.accent : colors.destructive;
  const sqlType = getSQLType(entry.sql);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(entry.sql);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Query Options', entry.sql.slice(0, 80) + (entry.sql.length > 80 ? '…' : ''), [
      { text: 'Use in Editor', onPress },
      { text: 'Copy SQL', onPress: handleCopy },
      onDelete ? { text: 'Delete', style: 'destructive', onPress: () => onDelete() } : undefined,
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean) as any[]);
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: pressed ? colors.muted : colors.card,
          borderColor: colors.border,
          borderLeftColor: statusColor,
        },
      ]}
    >
      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <View style={[styles.sqlTypeBadge, { backgroundColor: sqlType.color + '1A' }]}>
            <Text style={[styles.sqlTypeText, { color: sqlType.color, fontFamily: MONO_FONT }]}>
              {sqlType.label}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.dbName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {entry.databaseName}
          </Text>
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatTimestamp(entry.timestamp)}
        </Text>
      </View>

      {/* SQL preview */}
      <Text
        style={[styles.sql, { color: colors.foreground, fontFamily: MONO_FONT }]}
        numberOfLines={2}
      >
        {truncateSQL(entry.sql, 140)}
      </Text>

      {/* Footer */}
      <View style={styles.footer}>
        {entry.success ? (
          <>
            <View style={styles.metaItem}>
              <Ionicons name="grid-outline" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {entry.rowCount} {entry.rowCount !== 1 ? 'rows' : 'row'}
              </Text>
            </View>
            <View style={[styles.dividerDot, { backgroundColor: colors.border }]} />
            <View style={styles.metaItem}>
              <Ionicons name="flash-outline" size={11} color={colors.mutedForeground} />
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
        <Pressable onPress={handleCopy} hitSlop={10} style={styles.iconAction}>
          <Ionicons name="copy-outline" size={13} color={colors.mutedForeground} />
        </Pressable>
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={10} style={styles.iconAction}>
            <Ionicons name="trash-outline" size={13} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    marginHorizontal: 15,
    marginVertical: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    padding: 12,
    gap: 7,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  sqlTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  sqlTypeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dbName: { fontSize: 12, fontWeight: '500', flex: 1 },
  time: { fontSize: 11 },
  sql: { fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  dividerDot: { width: 3, height: 3, borderRadius: 2 },
  errorText: { fontSize: 11, flex: 1 },
  spacer: { flex: 1 },
  iconAction: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
