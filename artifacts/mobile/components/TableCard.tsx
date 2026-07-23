import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { TableInfo } from '@/utils/sqliteManager';
import { formatNumber } from '@/utils/formatters';

interface TableCardProps {
  table: TableInfo;
  onPress: () => void;
  onLongPress?: () => void;
}

const TYPE_CONFIG = {
  table: { icon: 'table' as const, label: 'TABLE', color: '#58A6FF' },
  view: { icon: 'eye' as const, label: 'VIEW', color: '#D2A8FF' },
  index: { icon: 'book-open-variant' as const, label: 'INDEX', color: '#FFA657' },
  trigger: { icon: 'lightning-bolt' as const, label: 'TRIGGER', color: '#F85149' },
};

export function TableCard({ table, onPress, onLongPress }: TableCardProps) {
  const colors = useColors();
  const config = TYPE_CONFIG[table.type] ?? TYPE_CONFIG.table;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.secondary : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: config.color + '1A' }]}>
        <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {table.name}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.typeBadge, { backgroundColor: config.color + '22' }]}>
            <Text style={[styles.typeText, { color: config.color }]}>{config.label}</Text>
          </View>
          {table.type === 'table' && table.rowCount !== undefined && (
            <Text style={[styles.rowCount, { color: colors.mutedForeground }]}>
              {formatNumber(table.rowCount)} row{table.rowCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      <MaterialIcons name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '500' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  rowCount: { fontSize: 12 },
});
