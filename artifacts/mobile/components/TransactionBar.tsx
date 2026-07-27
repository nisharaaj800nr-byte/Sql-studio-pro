/**
 * Transaction UI Bar — BEGIN / COMMIT / ROLLBACK buttons in the SQL editor.
 * All colors sourced from useColors() — fully theme-aware.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface TransactionBarProps {
  inTransaction: boolean;
  isLoading?: boolean;
  onBegin: () => void;
  onCommit: () => void;
  onRollback: () => void;
}

export function TransactionBar({
  inTransaction,
  isLoading = false,
  onBegin,
  onCommit,
  onRollback,
}: TransactionBarProps) {
  const colors = useColors();

  return (
    <View style={[
      styles.bar,
      {
        backgroundColor: inTransaction ? colors.warningSubtle : colors.card,
        borderTopColor: colors.border,
      },
    ]}>
      {inTransaction && (
        <View style={styles.indicator}>
          <View style={[styles.dot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.inTxText, { color: colors.warning }]}>Transaction open</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 'auto' }} />
      ) : !inTransaction ? (
        <Pressable
          onPress={onBegin}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="play-circle-outline" size={13} color={colors.foreground} />
          <Text style={[styles.btnText, { color: colors.foreground }]}>BEGIN</Text>
        </Pressable>
      ) : (
        <View style={styles.txBtns}>
          <Pressable
            onPress={onCommit}
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.accentSubtle, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="checkmark-circle-outline" size={13} color={colors.accent} />
            <Text style={[styles.btnText, { color: colors.accent }]}>COMMIT</Text>
          </Pressable>
          <Pressable
            onPress={onRollback}
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.destructiveSubtle, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="arrow-undo-circle-outline" size={13} color={colors.destructive} />
            <Text style={[styles.btnText, { color: colors.destructive }]}>ROLLBACK</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  inTxText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  txBtns: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7,
  },
  btnText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
