import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface StatCardProps {
  icon: IoniconName;
  label: string;
  value: string | number;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ icon, label, value, color, trend }: StatCardProps) {
  const colors = useColors();
  const iconColor = color ?? colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderTopColor: iconColor }]}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '1A' }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        {trend && trend !== 'neutral' && (
          <Ionicons
            name={trend === 'up' ? 'trending-up' : 'trending-down'}
            size={10}
            color={trend === 'up' ? colors.accent : colors.destructive}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 2,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  label: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
});
