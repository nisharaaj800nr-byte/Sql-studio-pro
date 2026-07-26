import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Legacy MaterialIcons name aliases — maps old icon names to Ionicons equivalents
const ICON_MAP: Record<string, IoniconName> = {
  'storage': 'archive-outline',
  'history': 'time-outline',
  'table-chart': 'grid-outline',
  'table-rows': 'grid-outline',
  'error': 'close-circle-outline',
  'check-circle': 'checkmark-circle-outline',
  'database': 'server-outline',
  'code-braces': 'code-slash-outline',
};

interface EmptyStateProps {
  icon: IoniconName | string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const colors = useColors();
  const resolvedIcon: IoniconName = (ICON_MAP[icon as string] ?? icon) as IoniconName;

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
        <Ionicons name={resolvedIcon} size={34} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: pressed ? colors.secondary : colors.primary },
          ]}
        >
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 280 },
  action: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionText: { fontSize: 14, fontWeight: '600' },
});
