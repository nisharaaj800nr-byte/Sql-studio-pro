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
  compact?: boolean;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, compact }: EmptyStateProps) {
  const colors = useColors();
  const resolvedIcon: IoniconName = (ICON_MAP[icon as string] ?? icon) as IoniconName;

  if (compact) {
    return (
      <View style={[compactStyles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[compactStyles.iconWrap, { backgroundColor: colors.primary + '14' }]}>
          <Ionicons name={resolvedIcon} size={20} color={colors.primary} />
        </View>
        <View style={compactStyles.text}>
          <Text style={[compactStyles.title, { color: colors.foreground }]}>{title}</Text>
          {description ? (
            <Text style={[compactStyles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>{description}</Text>
          ) : null}
        </View>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            style={({ pressed }) => [compactStyles.action, { backgroundColor: pressed ? colors.primaryHover : colors.primary }]}
          >
            <Text style={[compactStyles.actionText, { color: colors.primaryForeground }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Icon with layered rings for depth */}
      <View style={styles.iconStack}>
        <View style={[styles.iconRingOuter, { backgroundColor: colors.primary + '08' }]} />
        <View style={[styles.iconRingInner, { backgroundColor: colors.primary + '12' }]} />
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
          <Ionicons name={resolvedIcon} size={30} color={colors.primary} />
        </View>
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
            {
              backgroundColor: pressed ? colors.primaryHover : colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        >
          <Ionicons name="add-outline" size={16} color={colors.primaryForeground} />
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
    padding: 36,
    gap: 12,
  },
  iconStack: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconRingOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  iconRingInner: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  action: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionText: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
});

const compactStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    margin: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 12, marginTop: 1 },
  action: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionText: { fontSize: 13, fontWeight: '600' },
});
