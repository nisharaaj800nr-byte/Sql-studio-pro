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
  tableCount?: number;
  size?: number;
}

export function DatabaseCard({ database, onPress, onLongPress, tableCount, size }: DatabaseCardProps) {
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
          borderLeftColor: database.color,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: database.color + '1A' }]}>
        <MaterialCommunityIcons name="database" size={26} color={database.color} />
      </View>

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
              <MaterialIcons name="table-chart" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {tableCount} table{tableCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {size !== undefined && (
            <View style={styles.metaItem}>
              <MaterialIcons name="storage" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {formatBytes(size)}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatRelativeTime(database.lastModified)}
            </Text>
          </View>
        </View>
      </View>

      <MaterialIcons name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    gap: 14,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  desc: { fontSize: 13 },
  meta: { flexDirection: 'row', gap: 10, marginTop: 3, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
});
