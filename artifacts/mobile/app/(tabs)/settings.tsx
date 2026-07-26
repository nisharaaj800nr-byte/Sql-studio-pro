import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeMode } from '@/contexts/ThemeContext';
import { useEditor } from '@/contexts/EditorContext';
import { useDatabases } from '@/contexts/DatabaseContext';
import { getSQLiteCapabilitiesStandalone, type SQLiteCapabilities } from '@/utils/sqliteManager';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens (all hardcoded to premium dark theme matching reference)
// ─────────────────────────────────────────────────────────────────────────────

const D = {
  bg: '#0A0E14',
  card: '#111720',
  cardBorder: 'rgba(255,255,255,0.07)',
  section: '#0F1520',
  sectionLabel: '#4B5A72',
  rowLabel: '#E2E8F0',
  rowDesc: '#4B5A72',
  primary: '#4B7BFF',
  primarySubtle: 'rgba(75,123,255,0.12)',
  primaryGlow: 'rgba(75,123,255,0.25)',
  purple: '#8B5CF6',
  accent: '#3FB950',
  accentSubtle: 'rgba(63,185,80,0.15)',
  destructive: '#F85149',
  destructiveSubtle: 'rgba(248,81,73,0.12)',
  muted: 'rgba(255,255,255,0.05)',
  separator: 'rgba(255,255,255,0.06)',
  iconBg: (color: string) => color + '22',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// Animated press row
function PressRow({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
}) {
  const anim = useRef(new Animated.Value(1)).current;

  const onIn = () => {
    if (!onPress || disabled) return;
    Animated.spring(anim, { toValue: 0.97, useNativeDriver: false, speed: 40 }).start();
  };
  const onOut = () => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: false, speed: 40 }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      disabled={!onPress && disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Icon in a rounded colored background
function IconBox({
  name,
  set = 'material',
  color,
  size = 17,
}: {
  name: string;
  set?: 'ionicons' | 'material' | 'community';
  color: string;
  size?: number;
}) {
  const Comp: any =
    set === 'community'
      ? MaterialCommunityIcons
      : set === 'ionicons'
      ? Ionicons
      : MaterialIcons;

  return (
    <View style={[styles.iconBox, { backgroundColor: D.iconBg(color) }]}>
      <Comp name={name as any} size={size} color={color} />
    </View>
  );
}

// Standard setting row
interface RowProps {
  icon: string;
  iconSet?: 'ionicons' | 'material' | 'community';
  iconColor?: string;
  label: string;
  desc?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

function SettingRow({
  icon,
  iconSet = 'material',
  iconColor = D.primary,
  label,
  desc,
  right,
  onPress,
  danger = false,
  isFirst = false,
  isLast = false,
}: RowProps) {
  const labelColor = danger ? D.destructive : D.rowLabel;
  const tint = danger ? D.destructive : iconColor;

  return (
    <PressRow
      onPress={onPress}
      style={[
        styles.row,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
      ]}
    >
      <IconBox name={icon} set={iconSet} color={tint} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {desc !== undefined && (
          <Text style={[styles.rowDesc, { color: danger ? D.destructive + 'BB' : D.rowDesc }]}>
            {desc}
          </Text>
        )}
      </View>
      {right !== undefined
        ? right
        : onPress
        ? <MaterialIcons name="chevron-right" size={20} color={D.sectionLabel} />
        : null}
    </PressRow>
  );
}

// Section card wrapper
function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

// Premium blue switch
function BlueSwitch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Switch
      value={value}
      onValueChange={v => {
        onValueChange(v);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      trackColor={{ false: 'rgba(255,255,255,0.1)', true: D.primary }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="rgba(255,255,255,0.1)"
    />
  );
}

// Chevron value row (right side)
function ValueLabel({ text, color = D.primary }: { text: string; color?: string }) {
  return (
    <View style={styles.valueLabelRow}>
      <Text style={[styles.valueLabel, { color }]}>{text}</Text>
      <MaterialIcons name="chevron-right" size={18} color={D.sectionLabel} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme picker
// ─────────────────────────────────────────────────────────────────────────────

const THEME_OPTS: { mode: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { mode: 'dark',   label: 'Dark',  icon: 'moon' },
  { mode: 'light',  label: 'Light', icon: 'sunny' },
  { mode: 'system', label: 'Auto',  icon: 'phone-portrait-outline' },
];

function ThemePicker({
  themeMode,
  onSelect,
}: {
  themeMode: ThemeMode;
  onSelect: (m: ThemeMode) => void;
}) {
  return (
    <Card>
      {/* Header row */}
      <View style={[styles.row, styles.rowFirst, { paddingVertical: 14 }]}>
        <IconBox name="color-palette" set="ionicons" color={D.primary} />
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Theme</Text>
          <Text style={[styles.rowDesc, { color: D.rowDesc }]}>Choose your preferred theme</Text>
        </View>
        <View style={styles.chipRow}>
          <Text style={styles.classicChip}>Classic</Text>
          <MaterialIcons name="chevron-right" size={16} color={D.primary} />
        </View>
      </View>

      <Divider />

      {/* Three buttons */}
      <View style={styles.themeRow}>
        {THEME_OPTS.map(opt => {
          const active = themeMode === opt.mode;
          return (
            <Pressable
              key={opt.mode}
              onPress={() => {
                onSelect(opt.mode);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.themeBtn,
                active
                  ? {
                      backgroundColor: D.primarySubtle,
                      borderColor: D.primary,
                      shadowColor: D.primary,
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                    }
                  : {
                      backgroundColor: D.muted,
                      borderColor: D.cardBorder,
                    },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={22}
                color={active ? D.primary : D.sectionLabel}
              />
              <Text
                style={[
                  styles.themeBtnLabel,
                  { color: active ? D.primary : D.rowLabel, fontWeight: active ? '700' : '500' },
                ]}
              >
                {opt.label}
              </Text>
              {active && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLite Engine card with glow border
// ─────────────────────────────────────────────────────────────────────────────

function EngineCard({
  sqliteCaps,
  onPress,
}: {
  sqliteCaps: SQLiteCapabilities | null;
  onPress?: () => void;
}) {
  const CAPS = sqliteCaps
    ? [
        { label: 'Window',    ok: sqliteCaps.supportsWindowFunctions },
        { label: 'JSON',      ok: sqliteCaps.supportsJsonFunctions },
        { label: 'Math',      ok: sqliteCaps.supportsMathFunctions },
        { label: 'RETURNING', ok: sqliteCaps.supportsReturning },
        { label: 'Generated', ok: sqliteCaps.supportsGeneratedColumns },
        { label: 'STRICT',    ok: sqliteCaps.supportsStrictTables },
      ]
    : [];

  return (
    <View style={styles.engineOuter}>
      {/* Gradient border */}
      <LinearGradient
        colors={['#4B7BFF', '#7C5CFF', '#4B7BFF44']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.engineInner}>
        {/* Engine row */}
        <PressRow onPress={onPress} style={styles.engineRow}>
          <IconBox name="database" set="community" color={D.primary} size={18} />
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Engine</Text>
            <Text style={[styles.rowDesc]}>
              {sqliteCaps
                ? `SQLite v${sqliteCaps.version} · expo-sqlite`
                : 'Loading…'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={D.sectionLabel} />
        </PressRow>

        {/* Capability chips */}
        {CAPS.length > 0 && (
          <>
            <Divider />
            <View style={styles.capsWrap}>
              {CAPS.map(cap => (
                <View
                  key={cap.label}
                  style={[
                    styles.capChip,
                    {
                      backgroundColor: cap.ok ? D.accentSubtle : D.muted,
                      borderColor: cap.ok ? D.accent + '44' : D.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.capDot,
                      { backgroundColor: cap.ok ? D.accent : D.sectionLabel },
                    ]}
                  />
                  <Text
                    style={[
                      styles.capLabel,
                      { color: cap.ok ? D.accent : D.sectionLabel },
                    ]}
                  >
                    {cap.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

const FONT_SIZES   = [12, 13, 14, 15, 16, 18, 20];
const TAB_SIZES    = [2, 4];
const ROW_LIMITS   = [50, 100, 200, 500];
const TIMEOUT_OPTS = [10, 15, 30, 60, 120];
const EXPORT_FMTS  = ['csv', 'json', 'sql'] as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { queryHistory, savedQueries, clearHistory } = useEditor();
  const { databases } = useDatabases();
  const { settings, updateSetting, resetSettings } = useSettings();
  const { themeMode, setThemeMode } = useTheme();
  const [sqliteCaps, setSqliteCaps] = useState<SQLiteCapabilities | null>(null);

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 84 : 64;

  useEffect(() => {
    getSQLiteCapabilitiesStandalone()
      .then(setSqliteCaps)
      .catch(() => setSqliteCaps(null));
  }, []);

  // ── helpers ────────────────────────────────────────────────────────────────

  const pick = (
    title: string,
    current: any,
    options: { label: string; value: any }[],
    setter: (v: any) => void,
  ) => {
    Alert.alert(title, `Current: ${current}`, [
      ...options.map(o => ({
        text: `${o.label}${o.value === current ? '  ✓' : ''}`,
        onPress: () => {
          setter(o.value);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      `Delete all ${queryHistory.length} history entries? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearHistory();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    );
  };

  const handleResetSettings = () => {
    Alert.alert('Reset Settings', 'Restore all settings to defaults?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          resetSettings();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const handleEngineDetails = () => {
    if (!sqliteCaps) return;
    const features = [
      sqliteCaps.supportsWindowFunctions && 'Window functions',
      sqliteCaps.supportsJsonFunctions && 'JSON functions',
      sqliteCaps.supportsMathFunctions && 'Math functions',
      sqliteCaps.supportsReturning && 'RETURNING clause',
      sqliteCaps.supportsGeneratedColumns && 'Generated columns',
      sqliteCaps.supportsStrictTables && 'STRICT tables',
    ]
      .filter(Boolean)
      .join('\n');
    Alert.alert(
      `SQLite ${sqliteCaps.version}`,
      `Supported features:\n\n${features || 'Basic SQLite only'}`,
      [{ text: 'OK' }],
    );
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#4B7BFF', '#7C5CFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerIcon}
            >
              <Ionicons name="settings" size={18} color="#FFFFFF" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Settings</Text>
              <Text style={styles.headerSub}>Customize your SQL Studio experience</Text>
            </View>
          </View>
          <Pressable style={styles.headerBtn}>
            <Ionicons name="moon" size={18} color={D.primary} />
          </Pressable>
        </View>

        <View style={styles.content}>

          {/* ── APPEARANCE ────────────────────────────────────────── */}
          <SectionLabel title="Appearance" />
          <ThemePicker themeMode={themeMode} onSelect={setThemeMode} />

          {/* ── EDITOR ────────────────────────────────────────────── */}
          <SectionLabel title="Editor" />
          <Card>
            <SettingRow
              icon="text-fields"
              iconColor={D.primary}
              label="Font Size"
              desc={`${settings.fontSize}pt`}
              onPress={() =>
                pick(
                  'Editor Font Size',
                  `${settings.fontSize}pt`,
                  FONT_SIZES.map(s => ({ label: `${s}pt`, value: s })),
                  v => updateSetting('fontSize', v),
                )
              }
              isFirst
            />
            <Divider />
            <SettingRow
              icon="format-indent-increase"
              iconColor={D.primary}
              label="Tab Size"
              desc={`${settings.tabSize} spaces`}
              onPress={() =>
                pick(
                  'Tab Size',
                  `${settings.tabSize} spaces`,
                  TAB_SIZES.map(s => ({ label: `${s} spaces`, value: s })),
                  v => updateSetting('tabSize', v),
                )
              }
            />
            <Divider />
            <SettingRow
              icon="wrap-text"
              iconColor={D.primary}
              label="Word Wrap"
              right={
                <BlueSwitch
                  value={settings.wordWrap}
                  onValueChange={v => updateSetting('wordWrap', v)}
                />
              }
            />
            <Divider />
            <SettingRow
              icon="spellcheck"
              iconColor={D.primary}
              label="Auto-Complete"
              right={
                <BlueSwitch
                  value={settings.autoComplete}
                  onValueChange={v => updateSetting('autoComplete', v)}
                />
              }
              isLast
            />
          </Card>

          {/* ── QUERY ─────────────────────────────────────────────── */}
          <SectionLabel title="Query" />
          <Card>
            <SettingRow
              icon="list"
              iconColor={D.primary}
              label="Result Row Limit"
              desc={`${settings.rowLimit} rows`}
              onPress={() =>
                pick(
                  'Result Row Limit',
                  `${settings.rowLimit} rows`,
                  ROW_LIMITS.map(l => ({ label: `${l} rows`, value: l })),
                  v => updateSetting('rowLimit', v),
                )
              }
              isFirst
            />
            <Divider />
            <SettingRow
              icon="timer"
              iconColor={D.primary}
              label="Query Timeout"
              desc={`${settings.queryTimeoutMs / 1000}s`}
              onPress={() =>
                pick(
                  'Query Timeout',
                  `${settings.queryTimeoutMs / 1000}s`,
                  TIMEOUT_OPTS.map(s => ({ label: `${s}s`, value: s * 1000 })),
                  v => updateSetting('queryTimeoutMs', v),
                )
              }
            />
            <Divider />
            <SettingRow
              icon="auto-fix-high"
              iconColor={D.primary}
              label="Auto-Format on Paste"
              right={
                <BlueSwitch
                  value={settings.autoFormatOnPaste}
                  onValueChange={v => updateSetting('autoFormatOnPaste', v)}
                />
              }
              isLast
            />
          </Card>

          {/* ── EXPORT DEFAULTS ───────────────────────────────────── */}
          <SectionLabel title="Export Defaults" />
          <Card>
            <SettingRow
              icon="file-download"
              iconColor={D.primary}
              label="Default Format"
              desc={settings.defaultExportFormat.toUpperCase()}
              onPress={() =>
                pick(
                  'Default Export Format',
                  settings.defaultExportFormat.toUpperCase(),
                  EXPORT_FMTS.map(f => ({ label: f.toUpperCase(), value: f })),
                  v => updateSetting('defaultExportFormat', v),
                )
              }
              isFirst
            />
            <Divider />
            <SettingRow
              icon="table-rows"
              iconColor={D.primary}
              label="Include CSV Headers"
              right={
                <BlueSwitch
                  value={settings.includeHeadersInCSV}
                  onValueChange={v => updateSetting('includeHeadersInCSV', v)}
                />
              }
              isLast
            />
          </Card>

          {/* ── DATA & STORAGE ────────────────────────────────────── */}
          <SectionLabel title="Data & Storage" />
          <Card>
            <SettingRow
              icon="storage"
              iconColor={D.primary}
              label="Databases"
              desc={`${databases.length} on device`}
              isFirst
            />
            <Divider />
            <SettingRow
              icon="history"
              iconColor={D.primary}
              label="Query History"
              desc={`${queryHistory.length} entries`}
              onPress={() => router.push('/(tabs)/history')}
            />
            <Divider />
            <SettingRow
              icon="bookmark"
              iconColor={D.primary}
              label="Saved Queries"
              desc={`${savedQueries.length} saved`}
            />
            <Divider />
            <SettingRow
              icon="delete-sweep"
              iconColor={D.destructive}
              label="Clear Query History"
              desc="Cannot be undone"
              onPress={handleClearHistory}
              danger
              isLast
            />
          </Card>

          {/* ── SQLITE ENGINE ─────────────────────────────────────── */}
          <SectionLabel title="SQLite Engine" />
          <EngineCard sqliteCaps={sqliteCaps} onPress={handleEngineDetails} />

          {/* ── ADVANCED ──────────────────────────────────────────── */}
          <SectionLabel title="Advanced" />
          <Card>
            <SettingRow
              icon="restore"
              iconColor={D.destructive}
              label="Reset All Settings"
              desc="Restore defaults"
              onPress={handleResetSettings}
              danger
              isFirst
              isLast
            />
          </Card>

          {/* ── ABOUT ─────────────────────────────────────────────── */}
          <SectionLabel title="About" />
          <Card>
            <SettingRow
              icon="information-circle"
              iconSet="ionicons"
              iconColor={D.primary}
              label="SQL Studio Pro"
              desc="Version 1.0.0 · Build 100"
              isFirst
            />
            <Divider />
            <SettingRow
              icon="bug-report"
              iconColor="#D2A8FF"
              label="Report a Bug"
              onPress={() => {}}
            />
            <Divider />
            <SettingRow
              icon="shield"
              iconSet="ionicons"
              iconColor={D.primary}
              label="Privacy Policy"
              onPress={() => {}}
              isLast
            />
          </Card>

          {/* ── FOOTER ────────────────────────────────────────────── */}
          <Text style={styles.footer}>
            SQL Studio Pro · Powerful SQLite IDE for mobile{'\n'}
            Built with Expo · React Native · expo-sqlite
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },
  scroll: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: D.primary,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E6EDF3',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 12,
    color: D.rowDesc,
    marginTop: 1,
    letterSpacing: 0.1,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: D.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: D.primary + '33',
  },

  // ── Content ─────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: D.sectionLabel,
    marginTop: 26,
    marginBottom: 8,
    marginLeft: 4,
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: D.cardBorder,
    overflow: 'hidden',
  },

  // ── Row ──────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    backgroundColor: D.card,
  },
  rowFirst: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  rowLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: D.rowLabel,
    letterSpacing: 0.1,
  },
  rowDesc: {
    fontSize: 12,
    color: D.rowDesc,
    letterSpacing: 0.1,
  },

  // ── Icon box ─────────────────────────────────────────────────────────────
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Divider ──────────────────────────────────────────────────────────────
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: D.separator,
    marginLeft: 58,
  },

  // ── Value label ──────────────────────────────────────────────────────────
  valueLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  valueLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: D.primary,
  },

  // ── Theme picker ─────────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  classicChip: {
    fontSize: 13,
    fontWeight: '600',
    color: D.primary,
  },
  themeRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  themeBtnLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: D.primary,
  },

  // ── SQLite Engine card ───────────────────────────────────────────────────
  engineOuter: {
    borderRadius: 14,
    padding: 1.5,
    overflow: 'hidden',
    shadowColor: D.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  engineInner: {
    backgroundColor: D.card,
    borderRadius: 13,
    overflow: 'hidden',
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    backgroundColor: D.card,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },

  // ── Capability chips ─────────────────────────────────────────────────────
  capsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 7,
    backgroundColor: D.card,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
  capChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  capDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  capLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: D.sectionLabel,
    lineHeight: 19,
    marginTop: 32,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
});
