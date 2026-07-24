/**
 * Task 2.14 + 2.16 — ER Diagram & Foreign Key Visualizer
 * Renders tables as cards with columns, and FK relationships as arrow labels.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getERSchema, ERTable } from '@/utils/sqliteManager';

interface ERDiagramProps {
  dbId: string;
}

export function ERDiagram({ dbId }: ERDiagramProps) {
  const colors = useColors();
  const [schema, setSchema] = useState<ERTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getERSchema(dbId);
      setSchema(s);
      setExpanded(new Set(s.map(t => t.name)));
    } finally {
      setLoading(false);
    }
  }, [dbId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // Build FK relationship summary
  const relationships: { from: string; fromCol: string; to: string; toCol: string }[] = [];
  for (const t of schema) {
    for (const fk of t.foreignKeys) {
      relationships.push({ from: t.name, fromCol: fk.from, to: fk.table, toCol: fk.to });
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading schema…</Text>
      </View>
    );
  }

  if (schema.length === 0) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="table-off" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tables found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* FK Relationships summary */}
      {relationships.length > 0 && (
        <View style={[styles.fkSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Foreign Key Relationships
          </Text>
          {relationships.map((rel, i) => (
            <View key={i} style={[styles.relRow, { borderTopColor: colors.border }]}>
              <View style={[styles.relTable, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.relTableText, { color: colors.primary }]}>{rel.from}</Text>
                <Text style={[styles.relCol, { color: colors.primary }]}>.{rel.fromCol}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={16} color={colors.mutedForeground} />
              <View style={[styles.relTable, { backgroundColor: colors.accent + '20' }]}>
                <Text style={[styles.relTableText, { color: colors.accent }]}>{rel.to}</Text>
                <Text style={[styles.relCol, { color: colors.accent }]}>.{rel.toCol}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Table cards */}
      {schema.map(table => {
        const isExpanded = expanded.has(table.name);
        const pkCols = table.columns.filter(c => c.pk > 0);
        const fkColNames = new Set(table.foreignKeys.map(fk => fk.from));
        const referencedBy = relationships.filter(r => r.to === table.name);

        return (
          <View key={table.name} style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Table header */}
            <Pressable
              onPress={() => toggleExpand(table.name)}
              style={[styles.tableHeader, { borderBottomColor: colors.border, borderBottomWidth: isExpanded ? 1 : 0 }]}
            >
              <MaterialCommunityIcons name="table" size={18} color={colors.primary} />
              <Text style={[styles.tableName, { color: colors.foreground }]}>{table.name}</Text>
              <Text style={[styles.colCount, { color: colors.mutedForeground }]}>
                {table.columns.length} cols
              </Text>
              {referencedBy.length > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accent + '22' }]}>
                  <Text style={[styles.badgeText, { color: colors.accent }]}>
                    ↙ {referencedBy.length}
                  </Text>
                </View>
              )}
              <MaterialIcons
                name={isExpanded ? 'expand-less' : 'expand-more'}
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>

            {isExpanded && table.columns.map(col => {
              const isPK = col.pk > 0;
              const isFK = fkColNames.has(col.name);
              return (
                <View key={col.name} style={[styles.colRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.colIcons}>
                    {isPK && <MaterialIcons name="vpn-key" size={12} color="#FFD700" />}
                    {isFK && <MaterialIcons name="link" size={12} color={colors.accent} />}
                    {!isPK && !isFK && <View style={{ width: 12 }} />}
                  </View>
                  <Text style={[styles.colName, { color: isPK ? '#FFD700' : isFK ? colors.accent : colors.foreground }]}>
                    {col.name}
                  </Text>
                  <Text style={[styles.colType, { color: colors.mutedForeground }]}>
                    {col.type || 'ANY'}
                  </Text>
                  <View style={styles.colFlags}>
                    {col.notnull ? (
                      <View style={[styles.flag, { backgroundColor: colors.destructive + '20' }]}>
                        <Text style={[styles.flagText, { color: colors.destructive }]}>NN</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  loadingText: { fontSize: 14 },
  emptyText: { fontSize: 15 },
  content: { padding: 16, gap: 12 },
  fkSection: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  relRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  relTable: { flexDirection: 'row', alignItems: 'baseline', gap: 2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  relTableText: { fontSize: 13, fontWeight: '700' },
  relCol: { fontSize: 11 },
  tableCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12,
  },
  tableName: { fontSize: 15, fontWeight: '700', flex: 1 },
  colCount: { fontSize: 12 },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  colRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colIcons: { width: 16, alignItems: 'center' },
  colName: { fontSize: 13, fontWeight: '500', flex: 1 },
  colType: { fontSize: 11, fontFamily: 'monospace' },
  colFlags: { flexDirection: 'row', gap: 4 },
  flag: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  flagText: { fontSize: 9, fontWeight: '800' },
});
