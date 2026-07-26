import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
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
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {/* Color accent bar */}
      <View style={[styles.accent, { backgroundColor: database.color }]} />

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: database.color + '20' }]}>
        <MaterialCommunityIcons name="database" size={22} color={database.color} />
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
              <MaterialIcons name="table-chart" size={10} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {tableCount} table{tableCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {size !== undefined && (
            <View style={styles.metaItem}>
              <MaterialIcons name="storage" size={10} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {formatBytes(size)}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={10} color={colors.mutedForeground} />
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
            <MaterialIcons name="edit" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: pressed ? colors.destructive + '20' : 'transparent' }]}
          >
            <MaterialIcons name="delete-outline" size={16} color={colors.destructive} />
          </Pressable>
        )}
        <MaterialIcons name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    gap: 12,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  desc: { fontSize: 12 },
  meta: { flexDirection: 'row', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
