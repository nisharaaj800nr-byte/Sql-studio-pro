import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { StatCard } from '@/components/StatCard';
import { DatabaseCard } from '@/components/DatabaseCard';
import { QueryHistoryItem } from '@/components/QueryHistoryItem';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatNumber } from '@/utils/formatters';
import * as Haptics from 'expo-haptics';

const QUICK_TEMPLATES = [
  { label: 'List Tables', icon: 'table-multiple' as const, sql: "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name;" },
  { label: 'Table Count', icon: 'counter' as const, sql: "SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type='table';" },
  { label: 'DB Stats', icon: 'database-cog' as const, sql: 'PRAGMA database_list;\nPRAGMA page_count;\nPRAGMA page_size;' },
  { label: 'Schema', icon: 'code-braces' as const, sql: "SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name;" },
];

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { databases, isLoading, setActiveDbId } = useDatabases();
  const { queryHistory, setCurrentSql, totalQueriesRun } = useEditor();

  const totalTables = 0; // Placeholder - would need async count
  const recentDBs = databases.slice(0, 3);
  const recentHistory = queryHistory.slice(0, 5);

  const handleQuickTemplate = (sql: string) => {
    setCurrentSql(sql);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/editor');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Platform.OS === 'web' ? 80 : insets.top + 16,
          paddingBottom: insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.appName, { color: colors.foreground }]}>SQL Studio Pro</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your mobile database IDE
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/ai')}
          style={[styles.aiBtn, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '44' }]}
        >
          <MaterialCommunityIcons name="robot-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          icon="database"
          label="Databases"
          value={databases.length}
          color="#58A6FF"
        />
        <StatCard
          icon="table-multiple"
          label="Queries Run"
          value={formatNumber(totalQueriesRun)}
          color="#3FB950"
        />
        <StatCard
          icon="history"
          label="History"
          value={formatNumber(queryHistory.length)}
          color="#D2A8FF"
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => router.push('/(tabs)/databases')}
            style={({ pressed }) => [
              styles.quickBtn,
              { backgroundColor: pressed ? '#58A6FF33' : '#58A6FF1A', borderColor: '#58A6FF44' },
            ]}
          >
            <MaterialCommunityIcons name="database-plus" size={22} color="#58A6FF" />
            <Text style={[styles.quickBtnText, { color: '#58A6FF' }]}>New DB</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/editor')}
            style={({ pressed }) => [
              styles.quickBtn,
              { backgroundColor: pressed ? '#3FB95033' : '#3FB9501A', borderColor: '#3FB95044' },
            ]}
          >
            <MaterialCommunityIcons name="play-circle-outline" size={22} color="#3FB950" />
            <Text style={[styles.quickBtnText, { color: '#3FB950' }]}>Run SQL</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/history')}
            style={({ pressed }) => [
              styles.quickBtn,
              { backgroundColor: pressed ? '#D2A8FF33' : '#D2A8FF1A', borderColor: '#D2A8FF44' },
            ]}
          >
            <MaterialCommunityIcons name="history" size={22} color="#D2A8FF" />
            <Text style={[styles.quickBtnText, { color: '#D2A8FF' }]}>History</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/ai')}
            style={({ pressed }) => [
              styles.quickBtn,
              { backgroundColor: pressed ? '#FFA65733' : '#FFA6571A', borderColor: '#FFA65744' },
            ]}
          >
            <MaterialCommunityIcons name="robot-outline" size={22} color="#FFA657" />
            <Text style={[styles.quickBtnText, { color: '#FFA657' }]}>AI Help</Text>
          </Pressable>
        </View>
      </View>

      {/* SQL Templates */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>SQL Templates</Text>
        <View style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {QUICK_TEMPLATES.map((t, idx) => (
            <Pressable
              key={t.label}
              onPress={() => handleQuickTemplate(t.sql)}
              style={({ pressed }) => [
                styles.templateItem,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: idx < QUICK_TEMPLATES.length - 1 ? 1 : 0,
                  backgroundColor: pressed ? colors.muted : 'transparent',
                },
              ]}
            >
              <View style={[styles.templateIcon, { backgroundColor: colors.primary + '1A' }]}>
                <MaterialCommunityIcons name={t.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.templateLabel, { color: colors.foreground }]}>{t.label}</Text>
              <MaterialIcons name="north-east" size={14} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Recent Databases */}
      {recentDBs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Databases</Text>
            <Pressable onPress={() => router.push('/(tabs)/databases')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {recentDBs.map(db => (
            <DatabaseCard
              key={db.id}
              database={db}
              onPress={() => {
                setActiveDbId(db.id);
                router.push(`/database/${db.id}`);
              }}
            />
          ))}
        </View>
      )}

      {/* Recent Query History */}
      {recentHistory.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Queries</Text>
            <Pressable onPress={() => router.push('/(tabs)/history')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {recentHistory.map(entry => (
            <QueryHistoryItem
              key={entry.id}
              entry={entry}
              onPress={() => {
                setCurrentSql(entry.sql);
                setActiveDbId(entry.databaseId);
                router.push('/(tabs)/editor');
              }}
            />
          ))}
        </View>
      )}

      {databases.length === 0 && !isLoading && (
        <View style={[styles.welcomeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="database-plus" size={48} color={colors.primary} />
          <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>Get Started</Text>
          <Text style={[styles.welcomeDesc, { color: colors.mutedForeground }]}>
            Create your first database to start managing SQLite data and running queries.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/databases')}
            style={[styles.welcomeBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.welcomeBtnText, { color: colors.primaryForeground }]}>
              Create Database
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 2 },
  aiBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 10 },
  seeAll: { fontSize: 14, fontWeight: '600' },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  quickBtnText: { fontSize: 11, fontWeight: '700' },
  templateCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  templateIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  welcomeCard: {
    margin: 16,
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  welcomeTitle: { fontSize: 22, fontWeight: '700' },
  welcomeDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  welcomeBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  welcomeBtnText: { fontSize: 16, fontWeight: '700' },
});
