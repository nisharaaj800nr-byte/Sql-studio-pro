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
import { MaterialIcons } from '@expo/vector-icons';
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === 'web' ? 74 : insets.top + 10,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
        {queryHistory.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <MaterialIcons name="delete-sweep" size={22} color={colors.destructive} />
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <MaterialIcons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search queries..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchText, { color: colors.foreground }]}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <MaterialIcons name="close" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats bar */}
      {queryHistory.length > 0 && (
        <View style={[styles.statsBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.statsText, { color: colors.mutedForeground }]}>
            {filtered.length} {filtered.length === 1 ? 'query' : 'queries'}
            {search ? ` matching "${search}"` : ' in history'}
          </Text>
          <View style={styles.statsRight}>
            <View style={[styles.statDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.statsText, { color: colors.mutedForeground }]}>
              {queryHistory.filter(q => q.success).length} successful
            </Text>
            <View style={[styles.statDot, { backgroundColor: colors.destructive, marginLeft: 12 }]} />
            <Text style={[styles.statsText, { color: colors.mutedForeground }]}>
              {queryHistory.filter(q => !q.success).length} failed
            </Text>
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
          { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 80 },
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
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
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statsRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsText: { fontSize: 12 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  list: { paddingTop: 4 },
});
