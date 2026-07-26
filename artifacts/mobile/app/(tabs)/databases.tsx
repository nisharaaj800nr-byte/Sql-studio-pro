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
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getTables, getDatabaseStats } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

interface DBStats {
  [id: string]: { tableCount: number; size: number };
}

type ModalMode = 'create' | 'rename' | null;

export default function DatabasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, createDatabase, deleteDatabase, updateDatabase } = useDatabases();
  const [search, setSearch] = useState('');
  const [dbStats, setDbStats] = useState<DBStats>({});
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [renameTarget, setRenameTarget] = useState<typeof databases[0] | null>(null);

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
          stats[db.id] = { tableCount: tables.filter(t => t.type === 'table').length, size: size.sizeBytes };
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

  const handleOptions = (db: typeof databases[0]) => {
    Alert.alert(db.name, 'Choose an action', [
      { text: 'Open Explorer', onPress: () => router.push(`/database/${db.id}`) },
      {
        text: 'Rename',
        onPress: () => {
          setRenameTarget(db);
          setModalMode('rename');
        },
      },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(db) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  const filtered = databases.filter(db =>
    db.name.toLowerCase().includes(search.toLowerCase()) ||
    db.description.toLowerCase().includes(search.toLowerCase())
  );

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 60;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Databases</Text>
        <Pressable
          onPress={handleCreate}
          hitSlop={10}
          style={[styles.addBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <MaterialIcons name="search" size={17} color={colors.mutedForeground} />
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
              <MaterialIcons name="close" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={d => d.id}
        renderItem={({ item }) => (
          <DatabaseCard
            database={item}
            onPress={() => router.push(`/database/${item.id}`)}
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
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
  list: { paddingTop: 8, paddingHorizontal: 16 },
});
