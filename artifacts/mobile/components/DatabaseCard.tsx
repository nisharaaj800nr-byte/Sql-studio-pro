import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      damping: 20,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 20,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          database.corrupt && { borderColor: colors.destructive + '50' },
        ]}
      >
        {/* Left accent bar */}
        <View style={[styles.accent, { backgroundColor: database.color }]} />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: database.color + '18' }]}>
          {database.corrupt ? (
            <Ionicons name="warning" size={20} color={colors.destructive} />
          ) : (
            <Ionicons name="server-outline" size={20} color={database.color} />
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {database.name}
            </Text>
            {database.corrupt && (
              <View style={[styles.corruptBadge, { backgroundColor: colors.destructiveSubtle }]}>
                <Text style={[styles.corruptText, { color: colors.destructive }]}>Corrupted</Text>
              </View>
            )}
          </View>

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
                  {tableCount} {tableCount !== 1 ? 'tables' : 'table'}
                </Text>
              </View>
            )}
            {size !== undefined && size > 0 && (
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

        {/* Actions */}
        <View style={styles.actions}>
          {onRename && (
            <Pressable
              onPress={onRename}
              hitSlop={10}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: pressed ? colors.muted : 'transparent' },
              ]}
            >
              <Ionicons name="pencil-outline" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              hitSlop={10}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: pressed ? colors.destructive + '18' : 'transparent' },
              ]}
            >
              <Ionicons name="trash-outline" size={15} color={colors.destructive} />
            </Pressable>
          )}
          <View style={[styles.chevronWrap, { backgroundColor: colors.muted }]}>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    gap: 10,
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  corruptBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  corruptText: { fontSize: 10, fontWeight: '700' },
  desc: { fontSize: 12 },
  meta: { flexDirection: 'row', gap: 10, marginTop: 1, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
