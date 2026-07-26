import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseMeta } from '@/contexts/DatabaseContext';
import { formatBytes, formatRelativeTime } from '@/utils/formatters';

interface DatabaseCardProps {
  database: DatabaseMeta;
  onPress: () => void;
  onLongPress?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  tableCount?: number;
  size?: number;
}

export function DatabaseCard({
  database,
  onPress,
  onLongPress,
  onRename,
  onDelete,
  tableCount,
  size,
}: DatabaseCardProps) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {/* Color accent bar */}
      <View style={[styles.accent, { backgroundColor: database.color }]} />

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: database.color + '18' }]}>
        <Ionicons name="server-outline" size={20} color={database.color} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {database.name}
        </Text>
        {database.description ? (
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
            {database.description}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {tableCount !== undefined && (
            <View style={styles.metaItem}>
              <Ionicons name="grid-outline" size={10} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {tableCount} table{tableCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {size !== undefined && (
            <View style={styles.metaItem}>
              <Ionicons name="archive-outline" size={10} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {formatBytes(size)}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatRelativeTime(database.lastModified)}
            </Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {onRename && (
          <Pressable
            onPress={onRename}
            hitSlop={8}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: pressed ? colors.muted : 'transparent' }]}
          >
            <Ionicons name="pencil-outline" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: pressed ? colors.destructive + '18' : 'transparent' }]}
          >
            <Ionicons name="trash-outline" size={15} color={colors.destructive} />
          </Pressable>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingRight: 10,
    marginVertical: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    gap: 10,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  desc: { fontSize: 12 },
  meta: { flexDirection: 'row', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
