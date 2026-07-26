import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditor } from '@/contexts/EditorContext';
import { useDatabases } from '@/contexts/DatabaseContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getSQLiteCapabilitiesStandalone, type SQLiteCapabilities } from '@/utils/sqliteManager';

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
  iconSet?: 'material' | 'community';
  iconColor?: string;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function SettingRow({ icon, iconSet = 'material', iconColor, label, description, right, onPress, isFirst, isLast }: RowProps) {
  const colors = useColors();
  const IconComponent = iconSet === 'community' ? MaterialCommunityIcons : MaterialIcons;
  return (
    <Pressable
      onPress={onPress}
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
      <View style={[styles.rowIconBg, { backgroundColor: (iconColor ?? colors.primary) + '20' }]}>
        <IconComponent name={icon as any} size={17} color={iconColor ?? colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {description !== undefined && (
          <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{description}</Text>
        )}
      </View>
      {right ?? (onPress ? <MaterialIcons name="chevron-right" size={19} color={colors.mutedForeground} /> : null)}
    </Pressable>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 58 }]} />;
}

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
const TAB_SIZES = [2, 4];
const ROW_LIMITS = [50, 100, 200, 500];
const TIMEOUT_OPTS = [10, 15, 30, 60, 120];
const EXPORT_FORMATS = ['csv', 'json', 'sql'] as const;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const { queryHistory, savedQueries, clearHistory } = useEditor();
  const { databases } = useDatabases();
  const { settings, updateSetting, resetSettings } = useSettings();
  const [sqliteCaps, setSqliteCaps] = useState<SQLiteCapabilities | null>(null);

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

  const handlePickFontSize = () => {
    Alert.alert('Editor Font Size', `Current: ${settings.fontSize}pt`, [
      ...FONT_SIZES.map(size => ({
        text: `${size}pt${size === settings.fontSize ? ' ✓' : ''}`,
        onPress: () => { updateSetting('fontSize', size); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickTabSize = () => {
    Alert.alert('Tab Size', `Current: ${settings.tabSize} spaces`, [
      ...TAB_SIZES.map(size => ({
        text: `${size} spaces${size === settings.tabSize ? ' ✓' : ''}`,
        onPress: () => { updateSetting('tabSize', size); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickRowLimit = () => {
    Alert.alert('Result Row Limit', `Current: ${settings.rowLimit} rows`, [
      ...ROW_LIMITS.map(limit => ({
        text: `${limit} rows${limit === settings.rowLimit ? ' ✓' : ''}`,
        onPress: () => { updateSetting('rowLimit', limit); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickTimeout = () => {
    Alert.alert('Query Timeout', `Current: ${settings.queryTimeoutMs / 1000}s`, [
      ...TIMEOUT_OPTS.map(sec => ({
        text: `${sec}s${sec === settings.queryTimeoutMs / 1000 ? ' ✓' : ''}`,
        onPress: () => { updateSetting('queryTimeoutMs', sec * 1000); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickExportFormat = () => {
    Alert.alert('Default Export Format', `Current: ${settings.defaultExportFormat.toUpperCase()}`, [
      ...EXPORT_FORMATS.map(fmt => ({
        text: `${fmt.toUpperCase()}${fmt === settings.defaultExportFormat ? ' ✓' : ''}`,
        onPress: () => { updateSetting('defaultExportFormat', fmt); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
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
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      <View style={styles.content}>
        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow
            icon="palette"
            label="Theme"
            description={`System (${scheme === 'dark' ? 'Dark' : 'Light'})`}
            isFirst isLast
          />
        </View>

        {/* Editor */}
        <SectionHeader title="Editor" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow icon="text-fields" label="Font Size" description={`${settings.fontSize}pt`} onPress={handlePickFontSize} isFirst />
          <Separator />
          <SettingRow icon="format-indent-increase" label="Tab Size" description={`${settings.tabSize} spaces`} onPress={handlePickTabSize} />
          <Separator />
          <SettingRow
            icon="wrap-text" label="Word Wrap"
            right={
              <Switch value={settings.wordWrap} onValueChange={v => { updateSetting('wordWrap', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} trackColor={{ true: colors.primary }} />
            }
          />
          <Separator />
          <SettingRow
            icon="spellcheck" label="Auto-Complete"
            right={
              <Switch value={settings.autoComplete} onValueChange={v => { updateSetting('autoComplete', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} trackColor={{ true: colors.primary }} />
            }
            isLast
          />
        </View>

        {/* Query */}
        <SectionHeader title="Query" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow icon="list" label="Result Row Limit" description={`${settings.rowLimit} rows`} onPress={handlePickRowLimit} isFirst />
          <Separator />
          <SettingRow
            icon="auto-fix-high" label="Auto-Format on Paste"
            right={
              <Switch value={settings.autoFormatOnPaste} onValueChange={v => { updateSetting('autoFormatOnPaste', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} trackColor={{ true: colors.primary }} />
            }
          />
          <Separator />
          <SettingRow icon="timer" label="Query Timeout" description={`${settings.queryTimeoutMs / 1000}s`} onPress={handlePickTimeout} isLast />
        </View>

        {/* Data & Storage */}
        <SectionHeader title="Data & Storage" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow icon="storage" label="Databases" description={`${databases.length} on device`} isFirst />
          <Separator />
          <SettingRow icon="history" label="Query History" description={`${queryHistory.length} entries`} onPress={() => router.push('/(tabs)/history')} />
          <Separator />
          <SettingRow icon="bookmark" label="Saved Queries" description={`${savedQueries.length} saved`} />
          <Separator />
          <SettingRow icon="delete-sweep" iconColor={colors.destructive} label="Clear Query History" description="Cannot be undone" onPress={handleClearHistory} isLast />
        </View>

        {/* Export */}
        <SectionHeader title="Export Defaults" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow icon="file-download" label="Default Format" description={settings.defaultExportFormat.toUpperCase()} onPress={handlePickExportFormat} isFirst />
          <Separator />
          <SettingRow
            icon="table-rows" label="Include CSV Headers"
            right={
              <Switch value={settings.includeHeadersInCSV} onValueChange={v => { updateSetting('includeHeadersInCSV', v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} trackColor={{ true: colors.primary }} />
            }
            isLast
          />
        </View>

        {/* Advanced */}
        <SectionHeader title="Advanced" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow icon="restore" iconColor={colors.destructive} label="Reset All Settings" description="Restore defaults" onPress={handleResetSettings} isFirst isLast />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={[styles.section, { borderColor: colors.border }]}>
          <SettingRow icon="info" label="SQL Studio Pro" description="Version 1.0.0 · Build 100" isFirst />
          <Separator />
          <SettingRow
            iconSet="community" icon="database" label="SQLite Engine"
            description={sqliteCaps ? `v${sqliteCaps.version} · expo-sqlite (native)` : 'Loading…'}
            onPress={sqliteCaps ? () => {
              const caps = [
                sqliteCaps.supportsWindowFunctions && 'Window functions',
                sqliteCaps.supportsJsonFunctions && 'JSON functions',
                sqliteCaps.supportsMathFunctions && 'Math functions',
                sqliteCaps.supportsReturning && 'RETURNING clause',
                sqliteCaps.supportsGeneratedColumns && 'Generated columns',
                sqliteCaps.supportsStrictTables && 'STRICT tables',
              ].filter(Boolean).join('\n');
              Alert.alert(`SQLite ${sqliteCaps.version}`, `Supported:\n${caps || 'Basic SQLite only'}`, [{ text: 'OK' }]);
            } : undefined}
          />
          <Separator />
          <SettingRow
            iconSet="community" icon="check-circle" label="Engine Capabilities"
            description={sqliteCaps ? [
              sqliteCaps.supportsWindowFunctions ? '✓ Window' : '✗ Window',
              sqliteCaps.supportsJsonFunctions ? '✓ JSON' : '✗ JSON',
              sqliteCaps.supportsMathFunctions ? '✓ Math' : '✗ Math',
              sqliteCaps.supportsReturning ? '✓ RETURNING' : '✗ RETURNING',
            ].join(' · ') : 'Loading…'}
          />
          <Separator />
          <SettingRow icon="bug-report" label="Report a Bug" onPress={() => {}} />
          <Separator />
          <SettingRow icon="privacy-tip" label="Privacy Policy" onPress={() => {}} isLast />
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          SQL Studio Pro · Powerful SQLite IDE for mobile{'\n'}
          Built with Expo + React Native + expo-sqlite
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
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 6,
    marginLeft: 2,
  },
  section: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowIconBg: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowDesc: { fontSize: 12, marginTop: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  footer: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 28, marginBottom: 8 },
});
