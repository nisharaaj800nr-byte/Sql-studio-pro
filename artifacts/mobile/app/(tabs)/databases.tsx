import React, { useEffect, useState } from 'react';
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
import { useDatabases } from '@/contexts/DatabaseContext';
import { DatabaseCard } from '@/components/DatabaseCard';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { InputModal } from '@/components/InputModal';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getTables, getDatabaseStats } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

interface DBStats {
  [id: string]: { tableCount: number; size: number };
}

type ModalMode = 'create' | 'rename' | null;
type SortMode = 'name' | 'modified' | 'size' | 'tables';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 78 : 56;

const SORT_OPTIONS: { key: SortMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'modified', label: 'Recent', icon: 'time-outline' },
  { key: 'name', label: 'Name', icon: 'text-outline' },
  { key: 'size', label: 'Size', icon: 'archive-outline' },
  { key: 'tables', label: 'Tables', icon: 'grid-outline' },
];

export default function DatabasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, createDatabase, deleteDatabase, updateDatabase } = useDatabases();
  const [search, setSearch] = useState('');
  const [dbStats, setDbStats] = useState<DBStats>({});
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [renameTarget, setRenameTarget] = useState<typeof databases[0] | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('modified');
  const [showSort, setShowSort] = useState(false);

  useEffect(() => {
    loadStats();
  }, [databases]);

  const loadStats = async () => {
    const stats: DBStats = {};
    await Promise.all(
      databases.map(async db => {
        try {
          const [tables, size] = await Promise.all([
            getTables(db.id),
            getDatabaseStats(db.id),
          ]);
          stats[db.id] = { tableCount: tables.filter((t: any) => t.type === 'table').length, size: size.sizeBytes };
        } catch {
          stats[db.id] = { tableCount: 0, size: 0 };
        }
      })
    );
    setDbStats(stats);
  };

  const handleCreate = () => {
    setRenameTarget(null);
    setModalMode('create');
  };

  const handleModalConfirm = async (name: string) => {
    setModalMode(null);
    if (modalMode === 'create') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const db = await createDatabase(name);
        router.push(`/database/${db.id}`);
      } catch {
        Alert.alert('Error', 'Could not create database.');
      }
    } else if (modalMode === 'rename' && renameTarget) {
      try {
        await updateDatabase(renameTarget.id, { name });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert('Error', 'Could not rename database.');
      }
    }
  };

  const handleDelete = (db: typeof databases[0]) => {
    Alert.alert(
      'Delete Database',
      `Delete "${db.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteDatabase(db.id);
          },
        },
      ]
    );
  };

  const handleRename = (db: typeof databases[0]) => {
    setRenameTarget(db);
    setModalMode('rename');
  };

  const handleOptions = (db: typeof databases[0]) => {
    Alert.alert(db.name, 'Choose an action', [
      { text: 'Open Explorer', onPress: () => router.push(`/database/${db.id}`) },
      { text: 'Rename', onPress: () => handleRename(db) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(db) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickSort = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Sort by', undefined, [
      ...SORT_OPTIONS.map(opt => ({
        text: `${opt.label}${sortMode === opt.key ? ' ✓' : ''}`,
        onPress: () => {
          setSortMode(opt.key);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const filtered = databases
    .filter(db =>
      db.name.toLowerCase().includes(search.toLowerCase()) ||
      db.description.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortMode) {
        case 'name': return a.name.localeCompare(b.name);
        case 'size': return (dbStats[b.id]?.size ?? 0) - (dbStats[a.id]?.size ?? 0);
        case 'tables': return (dbStats[b.id]?.tableCount ?? 0) - (dbStats[a.id]?.tableCount ?? 0);
        default: return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      }
    });

  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sortMode)?.label ?? 'Recent';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]}>Databases</Text>
          {databases.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>{databases.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {databases.length > 1 && (
            <Pressable
              onPress={handlePickSort}
              style={[styles.sortBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              hitSlop={8}
            >
              <Ionicons name="swap-vertical-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.sortLabel, { color: colors.mutedForeground }]}>{currentSortLabel}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleCreate}
            hitSlop={10}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search databases…"
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

      {/* Results count */}
      {search.length > 0 && (
        <View style={[styles.resultsBar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.resultsText, { color: colors.mutedForeground }]}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={d => d.id}
        renderItem={({ item }) => (
          <DatabaseCard
            database={item}
            onPress={() => router.push(`/database/${item.id}`)}
            onLongPress={() => handleOptions(item)}
            onRename={() => handleRename(item)}
            onDelete={() => handleDelete(item)}
            tableCount={dbStats[item.id]?.tableCount}
            size={dbStats[item.id]?.size}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 80 },
          filtered.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="storage"
            title={search ? 'No matches' : 'No databases yet'}
            description={
              search
                ? `No databases match "${search}"`
                : 'Create your first SQLite database to get started.'
            }
            actionLabel={search ? undefined : 'Create Database'}
            onAction={search ? undefined : handleCreate}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {databases.length > 0 && <FAB icon="add" onPress={handleCreate} />}

      <InputModal
        visible={modalMode === 'create'}
        title="New Database"
        message="Enter a name for your database."
        placeholder="e.g. MyApp, products, logs"
        confirmLabel="Create"
        onConfirm={handleModalConfirm}
        onCancel={() => setModalMode(null)}
      />
      <InputModal
        visible={modalMode === 'rename'}
        title="Rename Database"
        placeholder="New name"
        defaultValue={renameTarget?.name ?? ''}
        confirmLabel="Rename"
        onConfirm={handleModalConfirm}
        onCancel={() => setModalMode(null)}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: { fontSize: 12, fontWeight: '700' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sortLabel: { fontSize: 12, fontWeight: '600' },
  addBtn: {
    width: 33,
    height: 33,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
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
  resultsBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultsText: { fontSize: 12 },
  list: { paddingTop: 6, paddingHorizontal: 15 },
});
