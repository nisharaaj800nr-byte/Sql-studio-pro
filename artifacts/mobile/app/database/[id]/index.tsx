import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { TableCard } from '@/components/TableCard';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { getTables, executeQuery, TableInfo } from '@/utils/sqliteManager';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type TabKey = 'tables' | 'views' | 'indexes' | 'triggers';

const TABS: { key: TabKey; label: string; dbType: string }[] = [
  { key: 'tables', label: 'Tables', dbType: 'table' },
  { key: 'views', label: 'Views', dbType: 'view' },
  { key: 'indexes', label: 'Indexes', dbType: 'index' },
  { key: 'triggers', label: 'Triggers', dbType: 'trigger' },
];

export default function DatabaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getDb, setActiveDbId, touchDatabase } = useDatabases();
  const { setCurrentSql } = useEditor();
  const [activeTab, setActiveTab] = useState<TabKey>('tables');
  const [allItems, setAllItems] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const db = id ? getDb(id) : undefined;

  const loadItems = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await getTables(id);
      setAllItems(items);
    } catch (e) {
      console.error('[DB Detail] Failed to load tables:', e);
      setLoadError((e as Error).message ?? 'Failed to load database objects.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = allItems.filter(
    item => item.type === TABS.find(t => t.key === activeTab)?.dbType
  );

  const handleOpenInEditor = () => {
    if (id) {
      setActiveDbId(id);
      touchDatabase(id);
    }
    router.push('/(tabs)/editor');
  };

  const handleCreateTable = () => {
    Alert.prompt(
      'New Table',
      'Enter a name for the new table:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (tableName: string | undefined) => {
            if (!tableName?.trim() || !id) return;
            const sql = `CREATE TABLE IF NOT EXISTS "${tableName.trim()}" (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  created_at TEXT DEFAULT (datetime('now'))\n);`;
            const result = await executeQuery(id, sql);
            if (result.error) {
              Alert.alert('Error', result.error);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadItems();
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  const handleItemLongPress = (item: TableInfo) => {
    const actions: any[] = [];

    if (item.type === 'table') {
      actions.push({
        text: 'View Data',
        onPress: () => router.push(`/database/${id}/table/${encodeURIComponent(item.name)}`),
      });
    }

    if (item.sql) {
      actions.push({
        text: 'Copy SQL to Editor',
        onPress: () => {
          setCurrentSql(item.sql);
          setActiveDbId(id!);
          router.push('/(tabs)/editor');
        },
      });
    }

    if (item.type === 'table') {
      actions.push({
        text: 'Drop Table',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Drop Table',
            `Permanently drop "${item.name}"? All data will be lost.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Drop',
                style: 'destructive',
                onPress: async () => {
                  if (!id) return;
                  const r = await executeQuery(id, `DROP TABLE IF EXISTS "${item.name}"`);
                  if (r.error) {
                    Alert.alert('Error', r.error);
                  } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    loadItems();
                  }
                },
              },
            ]
          );
        },
      });
    }

    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(item.name, `${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`, actions);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: db?.name ?? 'Database',
          headerRight: () => (
            <Pressable onPress={handleOpenInEditor} hitSlop={8} style={{ marginRight: Platform.OS === 'ios' ? 0 : 8 }}>
              <MaterialIcons name="code" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {/* DB Info bar */}
      {db && (
        <View style={[styles.infoBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.dbDot, { backgroundColor: db.color }]} />
          <Text style={[styles.dbName, { color: colors.foreground }]} numberOfLines={1}>
            {db.name}
          </Text>
          {db.description ? (
            <Text style={[styles.dbDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
              {db.description}
            </Text>
          ) : null}
          <Pressable onPress={handleOpenInEditor} style={[styles.queryBtn, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="play-arrow" size={14} color={colors.primaryForeground} />
            <Text style={[styles.queryBtnText, { color: colors.primaryForeground }]}>Query</Text>
          </Pressable>
        </View>
      )}

      {/* Error state */}
      {loadError && (
        <View style={[styles.errorBar, { backgroundColor: colors.destructive + '1A', borderColor: colors.destructive + '44' }]}>
          <MaterialIcons name="error-outline" size={16} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]} numberOfLines={2}>
            {loadError}
          </Text>
          <Pressable onPress={loadItems} hitSlop={8}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map(tab => {
          const count = allItems.filter(i => i.type === tab.dbType).length;
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                isActive && { borderBottomWidth: 2, borderBottomColor: colors.primary },
              ]}
            >
              <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.badge, { backgroundColor: isActive ? colors.primary : colors.muted }]}>
                  <Text style={[styles.badgeText, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.name}
          renderItem={({ item }) => (
            <TableCard
              table={item}
              onPress={() => {
                if (item.type === 'table') {
                  router.push(`/database/${id}/table/${encodeURIComponent(item.name)}`);
                } else {
                  handleItemLongPress(item);
                }
              }}
              onLongPress={() => handleItemLongPress(item)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            filtered.length === 0 && { flex: 1 },
            { paddingBottom: insets.bottom + 100 },
          ]}
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'tables' ? 'table-chart' : activeTab === 'views' ? 'visibility' : activeTab === 'indexes' ? 'sort' : 'flash-on'}
              title={`No ${activeTab}`}
              description={
                activeTab === 'tables'
                  ? 'Create your first table to store data.'
                  : `No ${activeTab} in this database yet.`
              }
              actionLabel={activeTab === 'tables' ? 'Create Table' : undefined}
              onAction={activeTab === 'tables' ? handleCreateTable : undefined}
            />
          }
          onRefresh={loadItems}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
        />
      )}

      {activeTab === 'tables' && !isLoading && (
        <FAB icon="add" onPress={handleCreateTable} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  dbDot: { width: 10, height: 10, borderRadius: 5 },
  dbName: { fontSize: 14, fontWeight: '600', flex: 1 },
  dbDesc: { fontSize: 12, flex: 1 },
  queryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  queryBtnText: { fontSize: 12, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 5,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 4 },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  errorText: { fontSize: 13, flex: 1 },
  retryText: { fontSize: 13, fontWeight: '700' },
});
