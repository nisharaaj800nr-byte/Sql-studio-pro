import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditor } from '@/contexts/EditorContext';
import { QueryHistoryItem } from '@/components/QueryHistoryItem';
import { EmptyState } from '@/components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { queryHistory, deleteHistoryEntry, clearHistory, setCurrentSql } = useEditor();
  const [search, setSearch] = useState('');

  const filtered = queryHistory.filter(q =>
    q.sql.toLowerCase().includes(search.toLowerCase()) ||
    q.databaseName.toLowerCase().includes(search.toLowerCase())
  );

  const successCount = queryHistory.filter(q => q.success).length;
  const failCount = queryHistory.filter(q => !q.success).length;

  const handleUse = (sql: string) => {
    setCurrentSql(sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/editor');
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleClear = () => {
    Alert.alert('Clear History', 'Delete all query history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => {
          clearHistory();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 58;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
        {queryHistory.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search queries…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchText, { color: colors.foreground }]}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats pill row */}
      {queryHistory.length > 0 && (
        <View style={[styles.statsBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.statsTotal, { color: colors.mutedForeground }]}>
            {filtered.length} {filtered.length === 1 ? 'query' : 'queries'}
            {search ? ` matching "${search}"` : ''}
          </Text>
          <View style={styles.statsRight}>
            <View style={[styles.pill, { backgroundColor: colors.accent + '22' }]}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.pillText, { color: colors.accent }]}>{successCount} ok</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.destructive + '22' }]}>
              <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
              <Text style={[styles.pillText, { color: colors.destructive }]}>{failCount} failed</Text>
            </View>
          </View>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={q => q.id}
        renderItem={({ item }) => (
          <QueryHistoryItem
            entry={item}
            onPress={() => handleUse(item.sql)}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          filtered.length === 0 && { flex: 1 },
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 },
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="history"
            title={search ? 'No matches' : 'No query history'}
            description={
              search
                ? `No queries match "${search}"`
                : 'Executed queries will appear here. Run your first SQL query to get started.'
            }
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchText: { flex: 1, fontSize: 15 },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statsTotal: { fontSize: 12 },
  statsRight: { flexDirection: 'row', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600' },
  list: { paddingTop: 4 },
});
