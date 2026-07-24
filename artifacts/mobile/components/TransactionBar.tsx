/**
 * Task 2.18 — Transaction UI Bar
 * Shows BEGIN / COMMIT / ROLLBACK buttons in the SQL editor.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
    <View style={[styles.bar, { backgroundColor: inTransaction ? '#2D1A00' : colors.card, borderTopColor: colors.border }]}>
      {inTransaction && (
        <View style={styles.indicator}>
          <View style={[styles.dot, { backgroundColor: '#FFA657' }]} />
          <Text style={styles.inTxText}>In Transaction</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 'auto' }} />
      ) : !inTransaction ? (
        <Pressable
          onPress={onBegin}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialIcons name="play-circle-outline" size={14} color={colors.foreground} />
          <Text style={[styles.btnText, { color: colors.foreground }]}>BEGIN</Text>
        </Pressable>
      ) : (
        <View style={styles.txBtns}>
          <Pressable
            onPress={onCommit}
            style={({ pressed }) => [styles.btn, { backgroundColor: '#1A4A1A', opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="check-circle-outline" size={14} color="#3FB950" />
            <Text style={[styles.btnText, { color: '#3FB950' }]}>COMMIT</Text>
          </Pressable>
          <Pressable
            onPress={onRollback}
            style={({ pressed }) => [styles.btn, { backgroundColor: '#4A1A1A', opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="undo" size={14} color="#F85149" />
            <Text style={[styles.btnText, { color: '#F85149' }]}>ROLLBACK</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  inTxText: { color: '#FFA657', fontSize: 12, fontWeight: '700' },
  txBtns: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  btnText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
