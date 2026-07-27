import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useDatabases } from '@/contexts/DatabaseContext';
import { DatabaseCard } from '@/components/DatabaseCard';
import { InputModal } from '@/components/InputModal';
import { getTables, getDatabaseStats, dbFileExists } from '@/utils/sqliteManager';
import {
  pickAndImportDatabase,
  copyImportedDb,
  backupDatabase,
} from '@/utils/exportUtils';


const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 74;
const { width: SW } = Dimensions.get('window');

type ModalMode = 'create' | 'rename' | 'import-name' | null;
type SortMode  = 'name' | 'modified' | 'size' | 'tables';

interface DBStats { [id: string]: { tableCount: number; size: number } }

// ── Quick actions config ──────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    key:   'new',
    label: 'New Database',
    sub:   'Create new DB',
    icon:  'server' as const,
    bg:    ['#1E3A8A', '#3B82F6'] as [string, string],
  },
  {
    key:   'import',
    label: 'Import Database',
    sub:   'From file',
    icon:  'folder-open' as const,
    bg:    ['#3B0764', '#7C3AED'] as [string, string],
  },
  {
    key:   'scan',
    label: 'Scan Database',
    sub:   'Auto detect',
    icon:  'scan' as const,
    bg:    ['#064E3B', '#059669'] as [string, string],
  },
  {
    key:   'backup',
    label: 'Backup & Restore',
    sub:   'Secure your data',
    icon:  'cloud-upload' as const,
    bg:    ['#78350F', '#D97706'] as [string, string],
  },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DatabasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark  = colors.isDark;
  const { databases, createDatabase, deleteDatabase, updateDatabase } = useDatabases();

  const [search,         setSearch]         = useState('');
  const [dbStats,        setDbStats]        = useState<DBStats>({});
  const [modalMode,      setModalMode]      = useState<ModalMode>(null);
  const [renameTarget,   setRenameTarget]   = useState<typeof databases[0] | null>(null);
  const [sortMode,       setSortMode]       = useState<SortMode>('modified');
  const [importing,      setImporting]      = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [pendingImport,  setPendingImport]  = useState<{ uri: string; suggestedName: string } | null>(null);

  // Entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 8, useNativeDriver: false }),
    ]).start();
  }, []);

  // Load DB stats
  useEffect(() => { loadStats(); }, [databases]);

  const loadStats = async () => {
    const stats: DBStats = {};
    await Promise.all(databases.map(async db => {
      try {
        const [tables, size] = await Promise.all([getTables(db.id), getDatabaseStats(db.id)]);
        stats[db.id] = {
          tableCount: tables.filter((t: any) => t.type === 'table').length,
          size: size.sizeBytes,
        };
      } catch {
        stats[db.id] = { tableCount: 0, size: 0 };
      }
    }));
    setDbStats(stats);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreate = () => {
    setRenameTarget(null);
    setModalMode('create');
  };

  /** Import: pick a .db file, then ask for a display name */
  const handleImport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setImporting(true);
    try {
      const result = await pickAndImportDatabase();
      if (!result.success) { setImporting(false); return; }

      // Derive a suggested name from the filename
      const raw = result.filename ?? 'imported';
      const suggested = raw.replace(/\.(db|sqlite3?|s3db)$/i, '').replace(/[_-]/g, ' ');
      setPendingImport({ uri: result.uri!, suggestedName: suggested });
      setModalMode('import-name');
    } catch (e) {
      Alert.alert('Import Failed', (e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  /** Scan: look for .db files in the SQLite dir that aren't already imported */
  const handleScan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanning(true);
    try {
      const FileSystem = await import('expo-file-system');
      const dir = `${(FileSystem as any).documentDirectory}SQLite/`;
      const info = await (FileSystem as any).getInfoAsync(dir);
      if (!info.exists) {
        Alert.alert('Scan Complete', 'No SQLite directory found. Create a database first.');
        return;
      }
      const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
      const dbFiles = files.filter((f: string) => /\.(db|sqlite3?|s3db)$/i.test(f));

      // Find files whose IDs aren't tracked yet
      const knownIds = new Set(databases.map(d => d.id));
      const unknown  = dbFiles.filter((f: string) => {
        const id = f.replace(/^sqlstudio_/, '').replace(/\.db$/, '');
        return !knownIds.has(id);
      });

      if (unknown.length === 0) {
        Alert.alert('Scan Complete', 'All databases are already imported.');
        return;
      }

      Alert.alert(
        'Databases Found',
        `Found ${unknown.length} untracked database${unknown.length > 1 ? 's' : ''}:\n\n${unknown.join('\n')}\n\nImport them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import All',
            onPress: async () => {
              for (const f of unknown) {
                const name = f.replace(/^sqlstudio_/, '').replace(/\.(db|sqlite3?)$/i, '');
                try { await createDatabase(name); } catch {}
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Done', `${unknown.length} database${unknown.length > 1 ? 's' : ''} imported.`);
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Scan Failed', (e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  /** Backup & Restore: show options sheet */
  const handleBackupRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (databases.length === 0) {
      Alert.alert('No Databases', 'Create a database first before backing up.');
      return;
    }

    Alert.alert('Backup & Restore', 'Choose an action', [
      {
        text: 'Backup a Database',
        onPress: () => {
          if (databases.length === 1) {
            doBackup(databases[0]);
          } else {
            // Let user pick which database
            Alert.alert('Select Database', 'Which database would you like to backup?', [
              ...databases.map(db => ({
                text: db.name,
                onPress: () => doBackup(db),
              })),
              { text: 'Cancel', style: 'cancel' },
            ]);
          }
        },
      },
      {
        text: 'Restore from File',
        onPress: handleImport,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const doBackup = async (db: typeof databases[0]) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await backupDatabase(db.id, db.name);
    } catch (e) {
      Alert.alert('Backup Failed', (e as Error).message);
    }
  };

  /** After user names the imported file */
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

    } else if (modalMode === 'import-name' && pendingImport) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const db = await createDatabase(name);
        await copyImportedDb(pendingImport.uri, db.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Imported!', `"${name}" imported successfully.`, [
          { text: 'Open', onPress: () => router.push(`/database/${db.id}`) },
          { text: 'OK' },
        ]);
      } catch (e) {
        Alert.alert('Import Failed', (e as Error).message);
      } finally {
        setPendingImport(null);
      }
    }
  };

  const handleDelete = (db: typeof databases[0]) => {
    Alert.alert('Delete Database', `Delete "${db.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteDatabase(db.id);
        },
      },
    ]);
  };

  const handleOptions = (db: typeof databases[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(db.name, 'Choose an action', [
      { text: 'Open Explorer', onPress: () => router.push(`/database/${db.id}`) },
      { text: 'Backup', onPress: () => doBackup(db) },
      { text: 'Rename',  onPress: () => { setRenameTarget(db); setModalMode('rename'); } },
      { text: 'Delete',  style: 'destructive', onPress: () => handleDelete(db) },
      { text: 'Cancel',  style: 'cancel' },
    ]);
  };

  const handleSortPick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Sort by', undefined, [
      { text: `Recent${sortMode==='modified'?' ✓':''}`,  onPress: () => setSortMode('modified') },
      { text: `Name${sortMode==='name'?' ✓':''}`,         onPress: () => setSortMode('name') },
      { text: `Size${sortMode==='size'?' ✓':''}`,         onPress: () => setSortMode('size') },
      { text: `Tables${sortMode==='tables'?' ✓':''}`,     onPress: () => setSortMode('tables') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleQuickAction = (key: string) => {
    switch (key) {
      case 'new':    return handleCreate();
      case 'import': return handleImport();
      case 'scan':   return handleScan();
      case 'backup': return handleBackupRestore();
    }
  };

  const handleViewAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('All Actions', undefined, [
      { text: '＋ New Database',      onPress: handleCreate },
      { text: '📂 Import from File',  onPress: handleImport },
      { text: '🔍 Scan for DBs',      onPress: handleScan },
      { text: '☁️  Backup / Restore',  onPress: handleBackupRestore },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSecurityCard = () => {
    Alert.alert(
      '🛡️  Your Data is Safe',
      'All databases are stored exclusively on this device using SQLite.\n\n' +
      '• No cloud sync or uploads\n' +
      '• No analytics or telemetry\n' +
      '• No third-party access\n\n' +
      'Use Backup & Restore to create manual backups.',
      [{ text: 'Got it' }]
    );
  };

  // Filtered + sorted list
  const filtered = databases
    .filter(db => db.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortMode) {
        case 'name':   return a.name.localeCompare(b.name);
        case 'size':   return (dbStats[b.id]?.size ?? 0) - (dbStats[a.id]?.size ?? 0);
        case 'tables': return (dbStats[b.id]?.tableCount ?? 0) - (dbStats[a.id]?.tableCount ?? 0);
        default:       return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      }
    });

  const bg = colors.background;
  const busy = importing || scanning;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <Animated.View style={[s.header, { paddingTop: insets.top + 14, opacity: fadeAnim }]}>
        <View style={s.headerText}>
          <Text style={[s.eyebrow,  { color: colors.primary }]}>LOCAL WORKSPACE</Text>
          <Text style={[s.title,    { color: colors.foreground }]}>Databases</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Manage your SQLite databases locally
          </Text>
        </View>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleCreate(); }}
          style={({ pressed }) => [s.addBtn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <LinearGradient colors={['#6D28D9', '#4F8DFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addBtnGrad}>
            <Ionicons name="add" size={26} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ── SEARCH BAR ─────────────────────────────────────────────── */}
      <Animated.View style={[s.searchWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={17} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search databases..."
            placeholderTextColor={colors.mutedForeground}
            style={[s.searchInput, { color: colors.foreground }]}
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={17} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Pressable onPress={handleSortPick} hitSlop={10}>
              <Ionicons name="options-outline" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* ── CONTENT ────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Loading overlay for import/scan */}
          {busy && (
            <View style={[s.busyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[s.busyText, { color: colors.mutedForeground }]}>
                {importing ? 'Importing database…' : 'Scanning for databases…'}
              </Text>
            </View>
          )}

          {/* Database list or empty state */}
          {!busy && filtered.length === 0 && !search ? (
            <PremiumEmptyState onCreatePress={handleCreate} isDark={isDark} colors={colors} />
          ) : !busy && filtered.length === 0 && search ? (
            <SearchEmptyState query={search} isDark={isDark} colors={colors} />
          ) : !busy ? (
            <View style={s.listSection}>
              {filtered.map(db => (
                <DatabaseCard
                  key={db.id}
                  database={db}
                  onPress={() => router.push(`/database/${db.id}`)}
                  onLongPress={() => handleOptions(db)}
                  onRename={() => { setRenameTarget(db); setModalMode('rename'); }}
                  onDelete={() => handleDelete(db)}
                  tableCount={dbStats[db.id]?.tableCount}
                  size={dbStats[db.id]?.size}
                />
              ))}
            </View>
          ) : null}

          {/* Quick Actions */}
          <QuickActionsSection
            isDark={isDark}
            colors={colors}
            onAction={handleQuickAction}
            onViewAll={handleViewAll}
            busy={busy}
          />

          {/* Security info card */}
          <SecurityCard isDark={isDark} colors={colors} onPress={handleSecurityCard} />

        </Animated.View>
      </ScrollView>

      {/* ── MODALS ─────────────────────────────────────────────────── */}
      <InputModal
        visible={modalMode === 'create'}
        title="New Database"
        message="Enter a name for your SQLite database."
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
      <InputModal
        visible={modalMode === 'import-name'}
        title="Name this Database"
        message={`Importing: ${pendingImport?.suggestedName ?? 'database'}`}
        placeholder="Database name"
        defaultValue={pendingImport?.suggestedName ?? ''}
        confirmLabel="Import"
        onConfirm={handleModalConfirm}
        onCancel={() => { setModalMode(null); setPendingImport(null); }}
      />
    </View>
  );
}

// ── Premium Empty State ───────────────────────────────────────────────────────
function PremiumEmptyState({
  onCreatePress, isDark, colors,
}: { onCreatePress: () => void; isDark: boolean; colors: any }) {
  return (
    <View style={[es.card, {
      backgroundColor: colors.card,
      borderColor: colors.border,
    }]}>
      {/* 3-D DB illustration */}
      <View style={es.illustrationWrap}>
        <View style={es.glow1} />
        <View style={es.glow2} />
        <View style={es.ring1} />
        <View style={es.ring2} />
        <View style={es.ring3} />
        <View style={es.dbWrap}>
          <View style={es.dbTop}>
            <LinearGradient colors={['#A5B4FC', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={es.dbTopGrad}>
              <View style={es.dbTopEllipse} />
            </LinearGradient>
          </View>
          <LinearGradient colors={['#4338CA', '#3730A3', '#312E81']} style={es.dbBody}>
            <View style={es.dbHighlight} />
            <View style={es.dbSep} />
            <View style={es.dbSep2} />
          </LinearGradient>
          <LinearGradient colors={['#312E81', '#1E1B4B']} style={es.dbBottom} />
          <View style={es.dbBaseGlow} />
        </View>
        <View style={[es.dot, { top: 30, right: 30, backgroundColor: '#818CF8' }]} />
        <View style={[es.dot, { top: 50, left: 24, backgroundColor: '#4F8DFF', width: 5, height: 5 }]} />
        <View style={[es.dot, { bottom: 40, right: 20, backgroundColor: '#7C5CFF', width: 4, height: 4 }]} />
        <View style={[es.dot, { bottom: 60, left: 30, backgroundColor: '#A5B4FC', width: 3, height: 3 }]} />
        <View style={[es.dot, { top: 20, left: 60, backgroundColor: '#C7D2FE', width: 3, height: 3 }]} />
      </View>

      <Text style={[es.heading, { color: colors.foreground }]}>No databases yet</Text>
      <Text style={[es.desc,    { color: colors.mutedForeground }]}>
        Create your first SQLite database{'\n'}to get started.
      </Text>

      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCreatePress(); }}
        style={({ pressed }) => [es.btn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <LinearGradient colors={['#7C5CFF', '#4F8DFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={es.btnGrad}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={es.btnText}>Create Database</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Search Empty ──────────────────────────────────────────────────────────────
function SearchEmptyState({ query, isDark, colors }: { query: string; isDark: boolean; colors: any }) {
  return (
    <View style={[se.card, {
      backgroundColor: colors.card,
      borderColor: colors.border,
    }]}>
      <View style={[se.icon, { backgroundColor: colors.primarySubtle }]}>
        <Ionicons name="search-outline" size={26} color={colors.primary} />
      </View>
      <Text style={[se.title, { color: colors.foreground }]}>No matches</Text>
      <Text style={[se.desc,  { color: colors.mutedForeground }]}>
        No databases match "{query}"
      </Text>
    </View>
  );
}

// ── Quick Actions Section ─────────────────────────────────────────────────────
function QuickActionsSection({
  isDark, colors, onAction, onViewAll, busy,
}: {
  isDark: boolean; colors: any;
  onAction: (key: string) => void;
  onViewAll: () => void;
  busy: boolean;
}) {
  return (
    <View style={qa.wrap}>
      <View style={qa.header}>
        <Text style={[qa.title, { color: colors.foreground }]}>Quick Actions</Text>
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={[qa.viewAll, { color: colors.primary }]}>View All ›</Text>
        </Pressable>
      </View>
      <View style={qa.grid}>
        {QUICK_ACTIONS.map(a => (
          <Pressable
            key={a.key}
            onPress={() => onAction(a.key)}
            disabled={busy}
            style={({ pressed }) => [
              qa.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: busy ? 0.5 : pressed ? 0.82 : 1,
                transform: [{ scale: pressed && !busy ? 0.95 : 1 }],
              },
            ]}
          >
            <LinearGradient colors={a.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={qa.iconBox}>
              <Ionicons name={a.icon} size={22} color="#FFF" />
            </LinearGradient>
            <Text style={[qa.label, { color: colors.foreground }]} numberOfLines={2}>{a.label}</Text>
            <Text style={[qa.sub,   { color: colors.mutedForeground }]}>{a.sub}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Security Card ─────────────────────────────────────────────────────────────
function SecurityCard({
  isDark, colors, onPress,
}: { isDark: boolean; colors: any; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        sc.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <LinearGradient colors={['#4338CA', '#4F8DFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sc.iconWrap}>
        <Ionicons name="shield-checkmark" size={20} color="#FFF" />
      </LinearGradient>
      <View style={sc.textWrap}>
        <Text style={[sc.title, { color: colors.foreground }]}>Your data is safe</Text>
        <Text style={[sc.desc,  { color: colors.mutedForeground }]}>
          All databases are stored locally on your device.{'\n'}We never access your data.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  headerText: { flex: 1 },
  eyebrow:    { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  title:      { fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginBottom: 4 },
  subtitle:   { fontSize: 13, lineHeight: 18 },
  addBtn:     { marginTop: 4 },
  addBtnGrad: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  searchWrap:  { paddingHorizontal: 20, marginBottom: 16 },
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  searchInput: { flex: 1, fontSize: 15 },

  listSection: { paddingHorizontal: 16, gap: 10, marginBottom: 8 },

  busyCard: {
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  busyText: { fontSize: 14, fontWeight: '500' },
});

const es = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 20,
    borderRadius: 24, borderWidth: 1,
    padding: 24, alignItems: 'center', overflow: 'hidden',
  },
  illustrationWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  glow1:  { position: 'absolute', width: 160, height: 80, borderRadius: 80, backgroundColor: 'rgba(79,141,255,0.18)', bottom: 20 },
  glow2:  { position: 'absolute', width: 120, height: 60, borderRadius: 60, backgroundColor: 'rgba(124,92,255,0.15)', bottom: 10 },
  ring1:  { position: 'absolute', width: 180, height: 40, borderRadius: 90, borderWidth: 1.5, borderColor: 'rgba(79,141,255,0.3)', bottom: 24 },
  ring2:  { position: 'absolute', width: 140, height: 28, borderRadius: 70, borderWidth: 1,   borderColor: 'rgba(124,92,255,0.2)', bottom: 30 },
  ring3:  { position: 'absolute', width: 100, height: 18, borderRadius: 50, borderWidth: 1,   borderColor: 'rgba(165,180,252,0.15)', bottom: 35 },
  dbWrap: { alignItems: 'center' },
  dbTop:  { width: 72, height: 20, borderRadius: 36, overflow: 'hidden' },
  dbTopGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dbTopEllipse: { width: 54, height: 12, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.25)' },
  dbBody: { width: 72, height: 64, marginTop: -2 },
  dbHighlight: { position: 'absolute', left: 8, top: 10, width: 16, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  dbSep:  { position: 'absolute', left: 0, right: 0, top: 26, height: 1.5, backgroundColor: 'rgba(255,255,255,0.12)' },
  dbSep2: { position: 'absolute', left: 0, right: 0, top: 48, height: 1.5, backgroundColor: 'rgba(255,255,255,0.10)' },
  dbBottom: { width: 72, height: 16, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, marginTop: -2 },
  dbBaseGlow: { width: 90, height: 14, borderRadius: 45, backgroundColor: 'rgba(79,141,255,0.35)', marginTop: 4 },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 8 },
  desc:    { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn:     { alignSelf: 'stretch', borderRadius: 28, overflow: 'hidden' },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 28 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

const se = StyleSheet.create({
  card:  { marginHorizontal: 16, marginBottom: 20, borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10 },
  icon:  { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700' },
  desc:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

const qa = StyleSheet.create({
  wrap:    { paddingHorizontal: 16, marginBottom: 16 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:   { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  viewAll: { fontSize: 13, fontWeight: '600' },
  grid:    { flexDirection: 'row', gap: 8 },
  card:    { flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, gap: 6, alignItems: 'center' },
  iconBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  label:   { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 15 },
  sub:     { fontSize: 10, textAlign: 'center', lineHeight: 13 },
});

const sc = StyleSheet.create({
  card:    { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  iconWrap:{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textWrap:{ flex: 1 },
  title:   { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  desc:    { fontSize: 12, lineHeight: 18 },
});
