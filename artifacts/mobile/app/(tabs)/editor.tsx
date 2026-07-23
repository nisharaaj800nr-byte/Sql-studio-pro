import React, { useCallback } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { SQLEditor } from '@/components/SQLEditor';
import { ResultGrid } from '@/components/ResultGrid';
import { EmptyState } from '@/components/EmptyState';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function EditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, activeDbId, setActiveDbId } = useDatabases();
  const {
    currentSql,
    setCurrentSql,
    queryResult,
    isExecuting,
    executeQuery,
    saveQuery,
  } = useEditor();

  const activeDb = databases.find(d => d.id === activeDbId);

  const handlePickDatabase = () => {
    if (databases.length === 0) {
      Alert.alert('No Databases', 'Create a database first.', [
        { text: 'Create', onPress: () => router.push('/(tabs)/databases') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(
      'Select Database',
      'Choose which database to query:',
      [
        ...databases.map(db => ({
          text: db.name,
          onPress: () => {
            setActiveDbId(db.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRun = useCallback(async () => {
    if (!activeDbId || !activeDb) {
      handlePickDatabase();
      return;
    }
    await executeQuery(activeDbId, activeDb.name, currentSql);
  }, [activeDbId, activeDb, currentSql, executeQuery]);

  const handleSave = () => {
    Alert.prompt('Save Query', 'Enter a name for this query:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: async (name: string | undefined) => {
          if (!name?.trim()) return;
          await saveQuery(name, currentSql, activeDbId ?? undefined);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ], 'plain-text');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'web' ? 67 : insets.top,
        },
      ]}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handlePickDatabase}
          style={[styles.dbSelector, { backgroundColor: colors.muted, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons
            name="database"
            size={16}
            color={activeDb?.color ?? colors.mutedForeground}
          />
          <Text
            style={[
              styles.dbSelectorText,
              { color: activeDb ? colors.foreground : colors.mutedForeground },
            ]}
            numberOfLines={1}
          >
            {activeDb ? activeDb.name : 'Select database...'}
          </Text>
          <MaterialIcons name="unfold-more" size={14} color={colors.mutedForeground} />
        </Pressable>

        <Pressable onPress={handleSave} style={styles.saveBtn} hitSlop={8}>
          <MaterialIcons name="bookmark-outline" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/(tabs)/history')}
          style={styles.historyBtn}
          hitSlop={8}
        >
          <MaterialIcons name="history" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Editor (top half) */}
      <View style={styles.editorContainer}>
        <SQLEditor
          value={currentSql}
          onChange={setCurrentSql}
          onRun={handleRun}
          isExecuting={isExecuting}
          databaseName={activeDb?.name}
          databaseColor={activeDb?.color}
        />
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]}>
        <View style={[styles.dividerHandle, { backgroundColor: colors.card }]}>
          <MaterialIcons name="drag-handle" size={18} color={colors.mutedForeground} />
        </View>
      </View>

      {/* Results (bottom half) */}
      <View style={[styles.resultsContainer, { backgroundColor: colors.background }]}>
        {queryResult ? (
          <ResultGrid result={queryResult} />
        ) : (
          <EmptyState
            icon="table-chart"
            title="No Results"
            description={
              activeDb
                ? 'Write a SQL query above and press Run'
                : 'Select a database, then write a query and press Run'
            }
          />
        )}
      </View>

      {/* Web bottom inset */}
      {Platform.OS === 'web' && <View style={{ height: 34 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  dbSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dbSelectorText: { flex: 1, fontSize: 14, fontWeight: '500' },
  saveBtn: { padding: 6 },
  historyBtn: { padding: 6 },
  editorContainer: { flex: 1 },
  divider: {
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dividerHandle: {
    position: 'absolute',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  resultsContainer: { flex: 1 },
});
