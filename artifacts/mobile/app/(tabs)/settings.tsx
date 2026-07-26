import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeMode } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditor } from '@/contexts/EditorContext';
import { useDatabases } from '@/contexts/DatabaseContext';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getSQLiteCapabilitiesStandalone, type SQLiteCapabilities } from '@/utils/sqliteManager';

// ── Reusable sub-components ──────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
      {title.toUpperCase()}
    </Text>
  );
}

interface RowProps {
  icon: string;
  iconSet?: 'ionicons' | 'material' | 'community';
  iconColor?: string;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  danger?: boolean;
}

function SettingRow({
  icon, iconSet = 'material', iconColor, label, description,
  right, onPress, isFirst, isLast, danger,
}: RowProps) {
  const colors = useColors();
  const tint = danger ? colors.destructive : (iconColor ?? colors.primary);

  let IconComp: any = MaterialIcons;
  if (iconSet === 'community') IconComp = MaterialCommunityIcons;
  if (iconSet === 'ionicons') IconComp = Ionicons;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !right}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          opacity: pressed && onPress ? 0.75 : 1,
          borderTopLeftRadius: isFirst ? 12 : 0,
          borderTopRightRadius: isFirst ? 12 : 0,
          borderBottomLeftRadius: isLast ? 12 : 0,
          borderBottomRightRadius: isLast ? 12 : 0,
        },
      ]}
    >
      <View style={[styles.rowIconBg, { backgroundColor: tint + '1E' }]}>
        <IconComp name={icon as any} size={17} color={tint} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: danger ? colors.destructive : colors.foreground }]}>
          {label}
        </Text>
        {description !== undefined && (
          <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{description}</Text>
        )}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <MaterialIcons name="chevron-right" size={19} color={colors.mutedForeground} />
          : null}
    </Pressable>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 58 }]} />;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
const TAB_SIZES = [2, 4];
const ROW_LIMITS = [50, 100, 200, 500];
const TIMEOUT_OPTS = [10, 15, 30, 60, 120];
const EXPORT_FORMATS = ['csv', 'json', 'sql'] as const;

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; desc: string }[] = [
  { mode: 'dark', label: 'Dark', icon: 'moon', desc: 'Obsidian' },
  { mode: 'light', label: 'Light', icon: 'sunny', desc: 'Slate' },
  { mode: 'system', label: 'Auto', icon: 'phone-portrait-outline', desc: 'OS default' },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { queryHistory, savedQueries, clearHistory } = useEditor();
  const { databases } = useDatabases();
  const { settings, updateSetting, resetSettings } = useSettings();
  const { themeMode, setThemeMode } = useTheme();
  const [sqliteCaps, setSqliteCaps] = useState<SQLiteCapabilities | null>(null);
  const [settingsSearch, setSettingsSearch] = useState('');

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 78 : 56;

  useEffect(() => {
    getSQLiteCapabilitiesStandalone()
      .then(setSqliteCaps)
      .catch(() => setSqliteCaps(null));
  }, []);

  const handleClearHistory = () => {
    Alert.alert('Clear History', `Delete all ${queryHistory.length} history entries?`, [
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

  const pick = (title: string, current: any, options: { label: string; value: any }[], setter: (v: any) => void) => {
    Alert.alert(title, `Current: ${current}`, [
      ...options.map(o => ({
        text: `${o.label}${o.value === current ? ' ✓' : ''}`,
        onPress: () => { setter(o.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleResetSettings = () => {
    Alert.alert('Reset Settings', 'Restore all settings to defaults?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => { resetSettings(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      <View style={styles.content}>

        {/* ── Appearance ──────────────────────────────────────────── */}
        <SectionHeader title="Appearance" />

        {/* Theme picker — premium card style */}
        <View style={[styles.themePickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.themeCardHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.themeIconBg, { backgroundColor: colors.primary + '1E' }]}>
              <Ionicons name="color-palette" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.themeCardTitle, { color: colors.foreground }]}>Theme</Text>
            <Text style={[styles.themeCardSub, { color: colors.mutedForeground }]}>
              {THEME_OPTIONS.find(t => t.mode === themeMode)?.desc ?? ''}
            </Text>
          </View>
          <View style={styles.themeOptions}>
            {THEME_OPTIONS.map(opt => {
              const active = themeMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  onPress={() => { setThemeMode(opt.mode); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: active ? colors.primary + '14' : colors.muted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.themeOptionLabel, { color: active ? colors.primary : colors.foreground, fontWeight: active ? '700' : '500' }]}>
                    {opt.label}
                  </Text>
                  {active && (
                    <View style={[styles.themeActiveDot, { backgroundColor: colors.primary }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Editor ──────────────────────────────────────────────── */}
        <SectionHeader title="Editor" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow
            iconSet="material" icon="text-fields" label="Font Size"
            description={`${settings.fontSize}pt`}
            onPress={() => pick('Editor Font Size', `${settings.fontSize}pt`, FONT_SIZES.map(s => ({ label: `${s}pt`, value: s })), v => updateSetting('fontSize', v))}
            isFirst
          />
          <Separator />
          <SettingRow
            iconSet="material" icon="format-indent-increase" label="Tab Size"
            description={`${settings.tabSize} spaces`}
            onPress={() => pick('Tab Size', `${settings.tabSize} spaces`, TAB_SIZES.map(s => ({ label: `${s} spaces`, value: s })), v => updateSetting('tabSize', v))}
          />
          <Separator />
          <SettingRow
            iconSet="material" icon="wrap-text" label="Word Wrap"
            right={
              <Switch
                value={settings.wordWrap}
                onValueChange={v => { updateSetting('wordWrap', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          <Separator />
          <SettingRow
            iconSet="material" icon="spellcheck" label="Auto-Complete"
            right={
              <Switch
                value={settings.autoComplete}
                onValueChange={v => { updateSetting('autoComplete', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
            isLast
          />
        </View>

        {/* ── Query ───────────────────────────────────────────────── */}
        <SectionHeader title="Query" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow
            iconSet="material" icon="list" label="Result Row Limit"
            description={`${settings.rowLimit} rows`}
            onPress={() => pick('Result Row Limit', `${settings.rowLimit} rows`, ROW_LIMITS.map(l => ({ label: `${l} rows`, value: l })), v => updateSetting('rowLimit', v))}
            isFirst
          />
          <Separator />
          <SettingRow
            iconSet="material" icon="timer" label="Query Timeout"
            description={`${settings.queryTimeoutMs / 1000}s`}
            onPress={() => pick('Query Timeout', `${settings.queryTimeoutMs / 1000}s`, TIMEOUT_OPTS.map(s => ({ label: `${s}s`, value: s * 1000 })), v => updateSetting('queryTimeoutMs', v))}
          />
          <Separator />
          <SettingRow
            iconSet="material" icon="auto-fix-high" label="Auto-Format on Paste"
            right={
              <Switch
                value={settings.autoFormatOnPaste}
                onValueChange={v => { updateSetting('autoFormatOnPaste', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
            isLast
          />
        </View>

        {/* ── Export ──────────────────────────────────────────────── */}
        <SectionHeader title="Export Defaults" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow
            iconSet="material" icon="file-download" label="Default Format"
            description={settings.defaultExportFormat.toUpperCase()}
            onPress={() => pick('Default Export Format', settings.defaultExportFormat.toUpperCase(), EXPORT_FORMATS.map(f => ({ label: f.toUpperCase(), value: f })), v => updateSetting('defaultExportFormat', v))}
            isFirst
          />
          <Separator />
          <SettingRow
            iconSet="material" icon="table-rows" label="Include CSV Headers"
            right={
              <Switch
                value={settings.includeHeadersInCSV}
                onValueChange={v => { updateSetting('includeHeadersInCSV', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
            isLast
          />
        </View>

        {/* ── Data & Storage ──────────────────────────────────────── */}
        <SectionHeader title="Data & Storage" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow iconSet="material" icon="storage" label="Databases" description={`${databases.length} on device`} isFirst />
          <Separator />
          <SettingRow iconSet="material" icon="history" label="Query History" description={`${queryHistory.length} entries`} onPress={() => router.push('/(tabs)/history')} />
          <Separator />
          <SettingRow iconSet="material" icon="bookmark" label="Saved Queries" description={`${savedQueries.length} saved`} />
          <Separator />
          <SettingRow
            iconSet="material" icon="delete-sweep" label="Clear Query History"
            description="Cannot be undone"
            onPress={handleClearHistory}
            danger
            isLast
          />
        </View>

        {/* ── SQLite Engine ───────────────────────────────────────── */}
        <SectionHeader title="SQLite Engine" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow
            iconSet="community" icon="database" label="Engine"
            description={sqliteCaps ? `SQLite v${sqliteCaps.version} · expo-sqlite` : 'Loading…'}
            isFirst
            onPress={sqliteCaps ? () => {
              const caps = [
                sqliteCaps.supportsWindowFunctions && 'Window functions',
                sqliteCaps.supportsJsonFunctions && 'JSON functions',
                sqliteCaps.supportsMathFunctions && 'Math functions',
                sqliteCaps.supportsReturning && 'RETURNING clause',
                sqliteCaps.supportsGeneratedColumns && 'Generated columns',
                sqliteCaps.supportsStrictTables && 'STRICT tables',
              ].filter(Boolean).join('\n');
              Alert.alert(`SQLite ${sqliteCaps.version}`, `Supported features:\n\n${caps || 'Basic SQLite only'}`, [{ text: 'OK' }]);
            } : undefined}
          />
          <Separator />
          {sqliteCaps && (
            <View style={[styles.capsRow, { backgroundColor: colors.card, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }]}>
              {[
                { label: 'Window', ok: sqliteCaps.supportsWindowFunctions },
                { label: 'JSON', ok: sqliteCaps.supportsJsonFunctions },
                { label: 'Math', ok: sqliteCaps.supportsMathFunctions },
                { label: 'RETURNING', ok: sqliteCaps.supportsReturning },
                { label: 'Generated', ok: sqliteCaps.supportsGeneratedColumns },
                { label: 'STRICT', ok: sqliteCaps.supportsStrictTables },
              ].map(cap => (
                <View key={cap.label} style={[styles.capBadge, { backgroundColor: cap.ok ? colors.accentSubtle : colors.muted }]}>
                  <Ionicons
                    name={cap.ok ? 'checkmark-circle' : 'close-circle'}
                    size={12}
                    color={cap.ok ? colors.accent : colors.mutedForeground}
                  />
                  <Text style={[styles.capText, { color: cap.ok ? colors.accent : colors.mutedForeground }]}>
                    {cap.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Advanced ────────────────────────────────────────────── */}
        <SectionHeader title="Advanced" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow
            iconSet="material" icon="restore" label="Reset All Settings"
            description="Restore defaults"
            onPress={handleResetSettings}
            danger
            isFirst isLast
          />
        </View>

        {/* ── About ───────────────────────────────────────────────── */}
        <SectionHeader title="About" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow iconSet="material" icon="info" label="SQL Studio Pro" description="Version 1.0.0 · Build 100" isFirst />
          <Separator />
          <SettingRow iconSet="material" icon="bug-report" label="Report a Bug" onPress={() => {}} />
          <Separator />
          <SettingRow iconSet="material" icon="privacy-tip" label="Privacy Policy" onPress={() => {}} isLast />
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          SQL Studio Pro · Powerful SQLite IDE for mobile{'\n'}
          Built with Expo · React Native · expo-sqlite
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 2,
  },

  section: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  rowIconBg: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowDesc: { fontSize: 12, marginTop: 1 },
  separator: { height: StyleSheet.hairlineWidth },

  // Theme picker
  themePickerCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  themeIconBg: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  themeCardTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  themeCardSub: { fontSize: 12 },
  themeOptions: { flexDirection: 'row', padding: 10, gap: 8 },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 7,
  },
  themeOptionLabel: { fontSize: 12 },
  themeActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // SQLite caps
  capsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 7,
  },
  capBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  capText: { fontSize: 11, fontWeight: '600' },

  footer: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 32, marginBottom: 8 },
});
