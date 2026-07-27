/**
 * SavedQueriesPanel — Premium draggable bottom sheet
 * All colors sourced from useColors() — fully theme-aware (dark / light / system).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SavedQuery } from '@/contexts/EditorContext';
import { formatDistanceToNow } from '@/utils/formatters';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.76;

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  savedQueries: SavedQuery[];
  onInsert: (sql: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// ── Glow orb illustration ────────────────────────────────────────────────────
function BookmarkOrb() {
  const c = useColors();
  return (
    <View style={orb.wrap}>
      <View style={[orb.ring4, { backgroundColor: c.primary }]} />
      <View style={[orb.ring3, { backgroundColor: c.primary }]} />
      <View style={[orb.ring2, { backgroundColor: c.primary }]} />
      <View style={[orb.ring1, { backgroundColor: c.primary }]} />

      {/* Inner gradient orb */}
      <LinearGradient
        colors={['#2952CC', '#1A3270', '#0F1B3E']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[orb.inner, { shadowColor: c.primary }]}
      >
        <Ionicons name="bookmark-outline" size={34} color="#79BAFF" />
      </LinearGradient>

      {/* Sparkle particles */}
      <Text style={[orb.sparkle, { top: 12, right: 32, fontSize: 18 }]}>+</Text>
      <Text style={[orb.sparkle, { top: 42, right: 8, fontSize: 11 }]}>+</Text>
      <Text style={[orb.sparkle, { bottom: 18, left: 22, fontSize: 14 }]}>+</Text>
      <View style={[orb.dot, { top: 28, left: 30 }]} />
      <View style={[orb.dot, { bottom: 30, right: 28, width: 4, height: 4, borderRadius: 2 }]} />
      <View style={[orb.dot, { top: 16, left: 56, width: 3, height: 3, borderRadius: 1.5, opacity: 0.5 }]} />
    </View>
  );
}

const orb = StyleSheet.create({
  wrap: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ring4: { position: 'absolute', width: 170, height: 170, borderRadius: 85, opacity: 0.06 },
  ring3: { position: 'absolute', width: 140, height: 140, borderRadius: 70, opacity: 0.10 },
  ring2: { position: 'absolute', width: 110, height: 110, borderRadius: 55, opacity: 0.17 },
  ring1: { position: 'absolute', width: 86, height: 86, borderRadius: 43, opacity: 0.25 },
  inner: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 2 },
    elevation: 12,
  },
  sparkle: { position: 'absolute', color: '#5B9EFF', fontWeight: '300' },
  dot: {
    position: 'absolute',
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: '#60A5FA',
    opacity: 0.65,
  },
});

// ── Query row ────────────────────────────────────────────────────────────────
function QueryRow({
  item,
  onInsert,
  onDelete,
}: {
  item: SavedQuery;
  onInsert: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onInsert}
      style={({ pressed }) => [
        row.container,
        { backgroundColor: pressed ? c.muted : 'transparent', borderBottomColor: c.border },
      ]}
    >
      {/* Icon */}
      <View style={[row.iconWrap, { shadowColor: c.primary }]}>
        <LinearGradient colors={['#1E3A8A', '#1A2E6E']} style={row.iconGrad}>
          <Ionicons name="bookmark" size={14} color="#79BAFF" />
        </LinearGradient>
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={[row.name, { color: c.foreground }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[row.sql, { color: c.mutedForeground }]} numberOfLines={2}>{item.sql}</Text>
        <Text style={[row.date, { color: c.border }]}>{formatDistanceToNow(item.createdAt)}</Text>
      </View>

      {/* Delete */}
      <Pressable onPress={onDelete} hitSlop={10} style={row.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color={c.destructive} />
      </Pressable>
    </Pressable>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  iconGrad: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  sql: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 16, marginBottom: 2 },
  date: { fontSize: 10 },
  deleteBtn: { padding: 4 },
});

// ── Main component ───────────────────────────────────────────────────────────
export function SavedQueriesPanel({ visible, savedQueries, onInsert, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const [search, setSearch]       = useState('');
  const [mounted, setMounted]     = useState(false);
  const translateY                = useRef(new Animated.Value(SHEET_H)).current;

  const slideIn = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0, damping: 22, stiffness: 260, mass: 1, useNativeDriver: false,
    }).start();
  }, [translateY]);

  const slideOut = useCallback((cb?: () => void) => {
    Animated.timing(translateY, {
      toValue: SHEET_H, duration: 240, useNativeDriver: false,
    }).start(() => cb?.());
  }, [translateY]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(() => slideIn());
    } else {
      slideOut(() => setMounted(false));
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    slideOut(onClose);
  }, [onClose, slideOut]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6 && gs.dy > 0,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 110 || gs.vy > 0.6) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          slideOut(onClose);
        } else {
          Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const filtered = useMemo(
    () => savedQueries.filter(q =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.sql.toLowerCase().includes(search.toLowerCase())
    ),
    [savedQueries, search]
  );

  if (!mounted && !visible) return null;

  return (
    <Modal
      visible={visible || mounted}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Overlay */}
      <Pressable style={s.overlay} onPress={handleClose}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
        )}
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { transform: [{ translateY }], paddingBottom: insets.bottom + 12, backgroundColor: c.card },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={[s.handle, { backgroundColor: c.border }]} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: c.foreground }]}>Saved Queries</Text>
          <Pressable onPress={handleClose} hitSlop={10} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={c.foreground} />
          </Pressable>
        </View>

        {/* Search + Filter row */}
        <View style={s.searchRow}>
          <View style={[s.searchWrap, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Ionicons name="search-outline" size={17} color={c.mutedForeground} style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search queries..."
              placeholderTextColor={c.mutedForeground}
              style={[s.searchInput, { color: c.foreground }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <Ionicons name="close-circle" size={15} color={c.mutedForeground} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [s.filterBtn, { backgroundColor: c.muted, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
            hitSlop={4}
          >
            <Ionicons name="options-outline" size={18} color={c.mutedForeground} />
          </Pressable>
        </View>

        {/* Content */}
        {filtered.length === 0 ? (
          <EmptyState hasSearch={search.length > 0} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={q => q.id}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <QueryRow
                item={item}
                onInsert={() => { onInsert(item.sql); onClose(); }}
                onDelete={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onDelete(item.id);
                }}
              />
            )}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  const c = useColors();
  return (
    <View style={es.container}>
      <BookmarkOrb />
      <Text style={[es.title, { color: c.foreground }]}>
        {hasSearch ? 'No matches found' : 'No saved queries yet'}
      </Text>
      <Text style={[es.desc, { color: c.mutedForeground }]}>
        {hasSearch
          ? 'Try a different search term.'
          : 'Use the bookmark icon in the editor\nto save a query.'}
      </Text>

      {!hasSearch && (
        <View style={[es.tipCard, { backgroundColor: c.muted, borderColor: c.border }]}>
          <LinearGradient
            colors={['#2D4CC8', '#1A3270']}
            style={[es.tipIcon, { shadowColor: c.primary }]}
          >
            <Ionicons name="star" size={20} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[es.tipLabel, { color: c.primary }]}>Quick Tip</Text>
            <Text style={[es.tipText, { color: c.mutedForeground }]}>
              Save your frequently used queries{'\n'}to access them quickly.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const es = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 6,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 8, letterSpacing: -0.3 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderRadius: 16, padding: 16, width: '100%',
  },
  tipIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  tipLabel: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  tipText: { fontSize: 13, lineHeight: 19 },
});

// ── Sheet styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 }, elevation: 20,
  },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 38, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, height: 46,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterBtn: {
    width: 46, height: 46, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
