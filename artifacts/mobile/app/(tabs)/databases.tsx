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
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getTables, getDatabaseStats } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';

interface DBStats {
  [id: string]: { tableCount: number; size: number };
}

export default function DatabasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, createDatabase, deleteDatabase, updateDatabase } = useDatabases();
  const [search, setSearch] = useState('');
  const [dbStats, setDbStats] = useState<DBStats>({});

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
    Alert.prompt(
      'New Database',
      'Enter a name for your database:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (name: string | undefined) => {
            if (!name?.trim()) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            try {
              const db = await createDatabase(name.trim());
              router.push(`/database/${db.id}`);
            } catch (e) {
              Alert.alert('Error', 'Could not create database.');
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  const handleLongPress = (db: typeof databases[0]) => {
    Alert.alert(db.name, 'Choose an action', [
      {
        text: 'Open Explorer',
        onPress: () => router.push(`/database/${db.id}`),
      },
      {
        text: 'Rename',
        onPress: () => handleRename(db),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleDelete(db),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRename = (db: typeof databases[0]) => {
    Alert.prompt(
      'Rename Database',
      'Enter new name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename',
          onPress: async (name: string | undefined) => {
            if (!name?.trim()) return;
            try {
              await updateDatabase(db.id, { name: name.trim() });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert('Error', 'Could not rename database.');
            }
          },
        },
      ],
      'plain-text',
      db.name
    );
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

  const filtered = databases.filter(db =>
    db.name.toLowerCase().includes(search.toLowerCase()) ||
    db.description.toLowerCase().includes(search.toLowerCase())
  );

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
        <Text style={[styles.title, { color: colors.foreground }]}>Databases</Text>
        <Pressable onPress={handleCreate} hitSlop={8}>
          <MaterialCommunityIcons name="database-plus" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <MaterialIcons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search databases..."
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

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={d => d.id}
        renderItem={({ item }) => (
          <DatabaseCard
            database={item}
            onPress={() => router.push(`/database/${item.id}`)}
            onLongPress={() => handleLongPress(item)}
            tableCount={dbStats[item.id]?.tableCount}
            size={dbStats[item.id]?.size}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
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

      {databases.length > 0 && (
        <FAB icon="add" onPress={handleCreate} />
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
  list: { paddingTop: 8 },
});
