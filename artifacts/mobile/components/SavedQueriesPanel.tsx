/**
 * Task 2.4 — Saved Queries / Snippets Manager Panel
 * Browse, insert, and delete saved SQL queries.
 */
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { SavedQuery } from '@/contexts/EditorContext';
import { formatDistanceToNow } from '@/utils/formatters';

interface SavedQueriesPanelProps {
  visible: boolean;
  savedQueries: SavedQuery[];
  onInsert: (sql: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function SavedQueriesPanel({
  visible,
  savedQueries,
  onInsert,
  onDelete,
  onClose,
}: SavedQueriesPanelProps) {
  const colors = useColors();
  const [search, setSearch] = useState('');

  const filtered = savedQueries.filter(
    q =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.sql.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>Saved Queries</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
            <MaterialIcons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search queries…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCorrect={false}
            />
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="bookmark-border" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search ? 'No matches' : 'No saved queries yet'}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Use the bookmark icon in the editor to save a query.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={q => q.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { onInsert(item.sql); onClose(); }}
                  style={({ pressed }) => [
                    styles.item,
                    { backgroundColor: pressed ? colors.muted : colors.background, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text
                      style={[styles.itemSql, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {item.sql}
                    </Text>
                    <Text style={[styles.itemDate, { color: colors.mutedForeground }]}>
                      {formatDistanceToNow(item.createdAt)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onDelete(item.id)}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <MaterialIcons name="delete-outline" size={20} color={colors.destructive} />
                  </Pressable>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '75%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginVertical: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  itemSql: { fontSize: 12, fontFamily: 'monospace', marginBottom: 4 },
  itemDate: { fontSize: 11 },
});
