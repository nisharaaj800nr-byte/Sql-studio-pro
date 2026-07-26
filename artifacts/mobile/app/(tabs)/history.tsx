import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  SectionList,
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
import { formatTimestamp } from '@/utils/formatters';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 78 : 56;

type FilterMode = 'all' | 'success' | 'failed';

function formatGroupDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { queryHistory, deleteHistoryEntry, clearHistory, setCurrentSql } = useEditor();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const successCount = queryHistory.filter(q => q.success).length;
  const failCount = queryHistory.filter(q => !q.success).length;

  const filtered = useMemo(() => {
    let result = queryHistory;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(q =>
        q.sql.toLowerCase().includes(lower) ||
        q.databaseName.toLowerCase().includes(lower)
      );
    }
    if (filter === 'success') result = result.filter(q => q.success);
    if (filter === 'failed') result = result.filter(q => !q.success);
    return result;
  }, [queryHistory, search, filter]);

  const sections = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const entry of filtered) {
      const key = formatGroupDate(entry.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  const handleUse = (sql: string, dbId: string) => {
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

  const FILTERS: { key: FilterMode; label: string; count: number; color?: string }[] = [
    { key: 'all', label: 'All', count: queryHistory.length },
    { key: 'success', label: 'Success', count: successCount, color: colors.accent },
    { key: 'failed', label: 'Failed', count: failCount, color: colors.destructive },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
          {queryHistory.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>{queryHistory.length}</Text>
            </View>
          )}
        </View>
        {queryHistory.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={10} style={[styles.clearBtn, { borderColor: colors.destructive + '40' }]}>
            <Ionicons name="trash-outline" size={15} color={colors.destructive} />
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search queries or database…"
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

      {/* Filter pills */}
      {queryHistory.length > 0 && (
        <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            const tint = f.color ?? colors.primary;
            return (
              <Pressable
                key={f.key}
                onPress={() => { setFilter(f.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? tint + '18' : colors.muted,
                    borderColor: active ? tint + '50' : colors.border,
                  },
                ]}
              >
                {active && <View style={[styles.filterDot, { backgroundColor: tint }]} />}
                <Text style={[styles.filterLabel, { color: active ? tint : colors.mutedForeground, fontWeight: active ? '700' : '500' }]}>
                  {f.label}
                </Text>
                {f.count > 0 && (
                  <Text style={[styles.filterCount, { color: active ? tint : colors.mutedForeground }]}>{f.count}</Text>
                )}
              </Pressable>
            );
          })}
          <View style={styles.spacer} />
          {search || filter !== 'all' ? (
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </Text>
          ) : null}
        </View>
      )}

      {/* Grouped list */}
      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={q => q.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <QueryHistoryItem
              entry={item}
              onPress={() => handleUse(item.sql, item.databaseId)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
        />
      ) : (
        <EmptyState
          icon="history"
          title={search || filter !== 'all' ? 'No matches' : 'No query history'}
          description={
            search
              ? `No queries match "${search}"`
              : filter !== 'all'
              ? `No ${filter} queries found`
              : 'Executed queries will appear here.'
          }
        />
      )}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, minWidth: 24, alignItems: 'center' },
  countText: { fontSize: 12, fontWeight: '700' },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 8,
  },
  searchText: { flex: 1, fontSize: 14 },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterDot: { width: 5, height: 5, borderRadius: 3 },
  filterLabel: { fontSize: 12 },
  filterCount: { fontSize: 11, fontWeight: '600' },
  spacer: { flex: 1 },
  resultCount: { fontSize: 12 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  list: { paddingTop: 4 },
});
