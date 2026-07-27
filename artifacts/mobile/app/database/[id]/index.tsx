/**
 * Database Detail Screen — Premium redesign
 * Visual parity with reference: dark theme, glow accents, glassmorphism.
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useDatabases } from '@/contexts/DatabaseContext';
import { useEditor } from '@/contexts/EditorContext';
import { TableCard } from '@/components/TableCard';
import { FAB } from '@/components/FAB';
import { DatabaseErrorBoundary } from '@/components/DatabaseErrorBoundary';
import { getTables, executeQuery, TableInfo } from '@/utils/sqliteManager';
import * as Haptics from 'expo-haptics';
import { CreateTableModal, ColumnDef } from '@/components/CreateTableModal';
import { ERDiagram } from '@/components/ERDiagram';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#090D14',
  cardBg:       '#0D1420',
  border:       '#1A2438',
  accent:       '#4B7BFF',
  accent2:      '#6E3AFF',
  textPrimary:  '#E8EEFF',
  textMuted:    '#4A5568',
  textSubtle:   '#2D3A50',
  grad:         ['#3B5BFF', '#6E3AFF'] as const,
  gradLight:    ['#4B7BFF', '#7C5CFF'] as const,
  errorBg:      'rgba(248,81,73,0.10)',
  errorBorder:  'rgba(248,81,73,0.25)',
  errorText:    '#F85149',
};

// ─── Tabs config ────────────────────────────────────────────────────────────────
type TabKey = 'tables' | 'views' | 'indexes' | 'triggers' | 'er';

const TABS: { key: TabKey; label: string; dbType?: string }[] = [
  { key: 'tables',   label: 'Tables',   dbType: 'table'   },
  { key: 'views',    label: 'Views',    dbType: 'view'    },
  { key: 'indexes',  label: 'Indexes',  dbType: 'index'   },
  { key: 'triggers', label: 'Triggers', dbType: 'trigger' },
  { key: 'er',       label: 'ER'                          },
];

// ─── Glowing table grid illustration ───────────────────────────────────────────

function GlowTableIllustration() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const outerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const outerScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.05] });
  const innerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.85] });

  // Scatter dots around the illustration
  const DOTS = [
    { x: 20,  y: 60,  r: 2,   op: 0.55 },
    { x: 165, y: 45,  r: 1.5, op: 0.45 },
    { x: 18,  y: 118, r: 1.5, op: 0.40 },
    { x: 162, y: 128, r: 2,   op: 0.50 },
    { x: 80,  y: 10,  r: 1.5, op: 0.35 },
    { x: 105, y: 174, r: 1.5, op: 0.40 },
    { x: 8,   y: 85,  r: 1.2, op: 0.30 },
    { x: 174, y: 90,  r: 1.2, op: 0.30 },
  ];

  return (
    <View style={ill.container}>
      {/* Ambient glow + dots */}
      <Svg
        width={186}
        height={186}
        viewBox="0 0 186 186"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#4B7BFF" stopOpacity="0.22" />
            <Stop offset="70%"  stopColor="#3B2CCC" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#4B7BFF" stopOpacity="0"    />
          </RadialGradient>
        </Defs>
        <Circle cx={93} cy={93} r={90} fill="url(#glow)" />
        {DOTS.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#6C8EFF" fillOpacity={d.op} />
        ))}
      </Svg>

      {/* Animated outer ring */}
      <Animated.View
        style={[
          ill.outerRing,
          { opacity: outerOpacity, transform: [{ scale: outerScale }] },
        ]}
      >
        <Svg width={186} height={186} viewBox="0 0 186 186">
          <Circle
            cx={93} cy={93} r={88}
            stroke="#4B7BFF"
            strokeWidth={1}
            strokeDasharray="5 8"
            strokeOpacity={0.5}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Animated mid ring */}
      <Animated.View style={[ill.midRing, { opacity: innerOpacity }]}>
        <Svg width={140} height={140} viewBox="0 0 140 140">
          <Circle
            cx={70} cy={70} r={67}
            stroke="#3D5ECC"
            strokeWidth={1.5}
            strokeDasharray="3 6"
            strokeOpacity={0.55}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Inner dark circle with 2×2 grid icon */}
      <View style={ill.innerCircle}>
        <Svg width={100} height={100} viewBox="0 0 100 100">
          {/* Dark fill */}
          <Circle cx={50} cy={50} r={49} fill="#06101E" />
          {/* Blue border ring */}
          <Circle
            cx={50} cy={50} r={46}
            stroke="#4B7BFF"
            strokeWidth={1.5}
            strokeOpacity={0.7}
            fill="none"
          />
          {/* 2×2 grid — top-left */}
          <Rect
            x="22" y="22" width="22" height="22"
            rx="4" ry="4"
            stroke="#4B7BFF" strokeWidth={2}
            strokeOpacity={0.95}
            fill="none"
          />
          {/* 2×2 grid — top-right */}
          <Rect
            x="56" y="22" width="22" height="22"
            rx="4" ry="4"
            stroke="#4B7BFF" strokeWidth={2}
            strokeOpacity={0.95}
            fill="none"
          />
          {/* 2×2 grid — bottom-left */}
          <Rect
            x="22" y="56" width="22" height="22"
            rx="4" ry="4"
            stroke="#4B7BFF" strokeWidth={2}
            strokeOpacity={0.95}
            fill="none"
          />
          {/* 2×2 grid — bottom-right */}
          <Rect
            x="56" y="56" width="22" height="22"
            rx="4" ry="4"
            stroke="#4B7BFF" strokeWidth={2}
            strokeOpacity={0.95}
            fill="none"
          />
        </Svg>
      </View>
    </View>
  );
}

const ill = StyleSheet.create({
  container: {
    width: 186,
    height: 186,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  outerRing: {
    position: 'absolute',
    width: 186,
    height: 186,
    alignItems: 'center',
    justifyContent: 'center',
  },
  midRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4B7BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.70,
    shadowRadius: 24,
    elevation: 14,
  },
});

// ─── Premium Empty State ────────────────────────────────────────────────────────

function PremiumEmptyState({
  tabKey,
  onCreateTable,
}: {
  tabKey: TabKey;
  onCreateTable?: () => void;
}) {
  const isTable = tabKey === 'tables';

  const titles: Record<TabKey, string> = {
    tables:   'No tables',
    views:    'No views',
    indexes:  'No indexes',
    triggers: 'No triggers',
    er:       'No relationships',
  };
  const descs: Record<TabKey, string> = {
    tables:   'Create your first table to store data.',
    views:    'No views in this database yet.',
    indexes:  'No indexes in this database yet.',
    triggers: 'No triggers in this database yet.',
    er:       'Add tables to visualize relationships.',
  };

  return (
    <View style={es.container}>
      <GlowTableIllustration />
      <Text style={es.title}>{titles[tabKey]}</Text>
      <Text style={es.desc}>{descs[tabKey]}</Text>

      {isTable && onCreateTable && (
        <Pressable
          onPress={onCreateTable}
          style={({ pressed }) => [es.btnWrap, { opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={C.grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={es.btnGrad}
          >
            <Text style={es.btnIcon}>+</Text>
            <Text style={es.btnLabel}>Create Table</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const es = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 14,
    gap: 10,
    borderRadius: 14,
  },
  btnIcon: {
    fontSize: 20,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 1,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
});

// ─── Gradient FAB ───────────────────────────────────────────────────────────────

function GradientFAB({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const TAB_H = Platform.OS === 'ios' ? 80 : 64;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        fab.wrap,
        {
          bottom: insets.bottom + TAB_H + 16,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <LinearGradient
        colors={C.gradLight}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={fab.grad}
      >
        <Text style={fab.plus}>+</Text>
      </LinearGradient>
    </Pressable>
  );
}

const fab = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#4B7BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  grad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },
});

// ─── Main screen ───────────────────────────────────────────────────────────────

function DatabaseDetailInner() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const colors    = useColors();
  const { getDb, setActiveDbId, touchDatabase } = useDatabases();
  const { setCurrentSql } = useEditor();

  const [activeTab, setActiveTab] = useState<TabKey>('tables');
  const [allItems, setAllItems]   = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateTable, setShowCreateTable] = useState(false);

  const db = id ? getDb(id) : undefined;

  // Tab indicator animation
  const tabAnim = useRef(new Animated.Value(0)).current;
  const tabIndex = TABS.findIndex(t => t.key === activeTab);

  useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: tabIndex,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  }, [tabIndex]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await getTables(id);
      setAllItems(items);
    } catch (e) {
      setLoadError((e as Error).message ?? 'Failed to load database objects.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = useMemo(
    () => allItems.filter(
      item => item.type === TABS.find(t => t.key === activeTab)?.dbType
    ),
    [allItems, activeTab]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreateTableWithCols = async (tableName: string, cols: ColumnDef[]) => {
    setShowCreateTable(false);
    if (!id) return;
    const colDefs = cols.map(c => {
      let def = `  "${c.name}" ${c.type}`;
      if (c.primaryKey) def += ' PRIMARY KEY AUTOINCREMENT';
      if (c.notNull && !c.primaryKey) def += ' NOT NULL';
      if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
      return def;
    });
    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${colDefs.join(',\n')}\n);`;
    const result = await executeQuery(id, sql);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadItems();
    }
  };

  const handleOpenInEditor = () => {
    if (id) { setActiveDbId(id); touchDatabase(id); }
    router.push('/(tabs)/editor');
  };

  const handleCreateTable = () => {
    setShowCreateTable(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
          Alert.alert('Drop Table', `Permanently drop "${item.name}"? All data will be lost.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Drop', style: 'destructive',
              onPress: async () => {
                if (!id) return;
                const r = await executeQuery(id, `DROP TABLE IF EXISTS "${item.name}"`);
                if (r.error) Alert.alert('Error', r.error);
                else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); loadItems(); }
              },
            },
          ]);
        },
      });
    }
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(item.name, item.type.charAt(0).toUpperCase() + item.type.slice(1), actions);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Stack.Screen — sets system nav bar title */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Premium sub-header ── */}
      <View style={s.subHeader}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.subHeaderTitle, { color: colors.foreground }]} numberOfLines={1}>
          {db?.name ?? 'Database'}
        </Text>
        <Pressable onPress={handleOpenInEditor} hitSlop={10} style={[s.codeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="code-slash-outline" size={20} color={C.accent} />
        </Pressable>
      </View>

      {/* ── DB info bar ── */}
      {db && (
        <View style={s.infoBar}>
          <View style={[s.dbDot, { backgroundColor: db.color ?? C.accent }]} />
          <Text style={[s.dbNameText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {db.name}
          </Text>
          <Pressable
            onPress={handleOpenInEditor}
            style={({ pressed }) => [s.queryBtnWrap, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={C.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.queryBtnGrad}
            >
              <Ionicons name="play" size={12} color="#FFFFFF" />
              <Text style={s.queryBtnText}>Query</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* ── Error bar ── */}
      {loadError && (
        <View style={s.errorBar}>
          <MaterialIcons name="error-outline" size={16} color={C.errorText} />
          <Text style={s.errorText} numberOfLines={2}>{loadError}</Text>
          <Pressable onPress={loadItems} hitSlop={8}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* ── Segmented tab bar ── */}
      <View style={s.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBarContent}
        >
          {TABS.map((tab, idx) => {
            const count   = allItems.filter(i => i.type === tab.dbType).length;
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  setActiveTab(tab.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={s.tabBtn}
              >
                <View style={s.tabBtnInner}>
                  <Text style={[s.tabLabel, { color: isActive ? C.accent : colors.mutedForeground }, isActive && s.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={[s.tabBadge, { backgroundColor: colors.card }, isActive && s.tabBadgeActive]}>
                      <Text style={[s.tabBadgeText, { color: colors.mutedForeground }, isActive && s.tabBadgeTextActive]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
                {isActive && <View style={s.tabIndicator} />}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[s.tabDivider, { backgroundColor: colors.border }]} />
      </View>

      {/* ── Content ── */}
      {activeTab === 'er' ? (
        id ? <ERDiagram dbId={id} /> : null
      ) : isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={C.accent} />
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
            s.listContent,
            filtered.length === 0 && { flex: 1 },
            { paddingBottom: insets.bottom + 100 },
          ]}
          ListEmptyComponent={
            <PremiumEmptyState
              tabKey={activeTab}
              onCreateTable={activeTab === 'tables' ? handleCreateTable : undefined}
            />
          }
          onRefresh={loadItems}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Gradient FAB ── */}
      {activeTab === 'tables' && !isLoading && (
        <GradientFAB onPress={handleCreateTable} />
      )}

      {/* ── Create Table modal ── */}
      <CreateTableModal
        visible={showCreateTable}
        onConfirm={handleCreateTableWithCols}
        onCancel={() => setShowCreateTable(false)}
      />
    </View>
  );
}

// ─── Root export with error boundary ──────────────────────────────────────────

export default function DatabaseDetailScreen() {
  const { id }           = useLocalSearchParams<{ id: string }>();
  const { deleteDatabase } = useDatabases();
  return (
    <DatabaseErrorBoundary
      onDeleteDatabase={id ? () => deleteDatabase(id) : undefined}
    >
      <DatabaseDetailInner />
    </DatabaseErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Sub-header
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  codeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 10,
  },
  dbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dbNameText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: 0.1,
  },
  queryBtnWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  queryBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderRadius: 20,
  },
  queryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },

  // Error bar
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.errorBorder,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 13, color: C.errorText },
  retryText:  { fontSize: 13, fontWeight: '700', color: C.accent },

  // Tab bar
  tabBarWrap: {},
  tabBarContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  tabBtn: {
    alignItems: 'center',
    paddingHorizontal: 4,
    marginRight: 8,
    position: 'relative',
    paddingBottom: 0,
  },
  tabBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: C.accent,
  },
  tabBadge: {
    backgroundColor: C.cardBg,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: C.accent + '22',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
  },
  tabBadgeTextActive: {
    color: C.accent,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    height: 2,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  tabDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 0,
  },

  // Content
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:  { paddingTop: 4 },
});
