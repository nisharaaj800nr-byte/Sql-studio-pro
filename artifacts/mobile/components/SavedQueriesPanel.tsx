/**
 * SavedQueriesPanel — Premium draggable bottom sheet
 * Matches reference design exactly:
 *  - Glassmorphism dark sheet with rounded top
 *  - Animated slide-in / drag-to-dismiss
 *  - Search bar + separate filter button
 *  - Glowing bookmark orb empty state with sparkles
 *  - Quick Tip info card
 *  - Full FlatList when queries exist
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

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.76;

// ── Design tokens ────────────────────────────────────────────────────────────
const BG       = '#090D12';
const SHEET_BG = '#0D1117';
const MUTED    = '#111820';
const BORDER   = '#21262D';
const FG       = '#E6EDF3';
const MUTED_FG = '#7D8590';
const ACCENT   = '#4B7BFF';
const HANDLE   = '#3D444D';

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
  return (
    <View style={orb.wrap}>
      {/* Outer diffuse glow rings */}
      <View style={orb.ring4} />
      <View style={orb.ring3} />
      <View style={orb.ring2} />
      <View style={orb.ring1} />

      {/* Inner gradient orb */}
      <LinearGradient
        colors={['#2952CC', '#1A3270', '#0F1B3E']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={orb.inner}
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
  ring4: {
    position: 'absolute',
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: ACCENT, opacity: 0.06,
  },
  ring3: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: ACCENT, opacity: 0.10,
  },
  ring2: {
    position: 'absolute',
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: ACCENT, opacity: 0.17,
  },
  ring1: {
    position: 'absolute',
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: ACCENT, opacity: 0.25,
  },
  inner: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 2 },
    elevation: 12,
  },
  sparkle: {
    position: 'absolute',
    color: '#5B9EFF',
    fontWeight: '300',
  },
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
  return (
    <Pressable
      onPress={onInsert}
      style={({ pressed }) => [
        row.container,
        { backgroundColor: pressed ? '#151D28' : 'transparent', borderBottomColor: BORDER },
      ]}
    >
      {/* Icon */}
      <View style={row.iconWrap}>
        <LinearGradient colors={['#1E3A8A', '#1A2E6E']} style={row.iconGrad}>
          <Ionicons name="bookmark" size={14} color="#79BAFF" />
        </LinearGradient>
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={row.name} numberOfLines={1}>{item.name}</Text>
        <Text style={row.sql} numberOfLines={2}>{item.sql}</Text>
        <Text style={row.date}>{formatDistanceToNow(item.createdAt)}</Text>
      </View>

      {/* Delete */}
      <Pressable onPress={onDelete} hitSlop={10} style={row.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color="#F85149" />
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
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  iconGrad: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: '600', color: FG, marginBottom: 2 },
  sql: { fontSize: 11, color: MUTED_FG, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 16, marginBottom: 2 },
  date: { fontSize: 10, color: '#3D444D' },
  deleteBtn: { padding: 4 },
});

// ── Main component ───────────────────────────────────────────────────────────
export function SavedQueriesPanel({ visible, savedQueries, onInsert, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch]       = useState('');
  const [mounted, setMounted]     = useState(false);
  const translateY                = useRef(new Animated.Value(SHEET_H)).current;

  // Animate in / out — useNativeDriver: false for web compat
  const slideIn = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      damping: 22,
      stiffness: 260,
      mass: 1,
      useNativeDriver: false,
    }).start();
  }, [translateY]);

  const slideOut = useCallback((cb?: () => void) => {
    Animated.timing(translateY, {
      toValue: SHEET_H,
      duration: 240,
      useNativeDriver: false,
    }).start(() => cb?.());
  }, [translateY]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Small delay so Modal is visible before animating
      requestAnimationFrame(() => slideIn());
    } else {
      slideOut(() => setMounted(false));
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    slideOut(onClose);
  }, [onClose, slideOut]);

  // Drag-to-dismiss via PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6 && gs.dy > 0,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
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
      {/* Overlay — tap to dismiss */}
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
          { transform: [{ translateY }], paddingBottom: insets.bottom + 12 },
        ]}
      >
        {/* Drag handle area */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Saved Queries</Text>
          <Pressable onPress={handleClose} hitSlop={10} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={FG} />
          </Pressable>
        </View>

        {/* Search + Filter row */}
        <View style={s.searchRow}>
          {/* Search input */}
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={17} color={MUTED_FG} style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search queries..."
              placeholderTextColor={MUTED_FG}
              style={s.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <Ionicons name="close-circle" size={15} color={MUTED_FG} />
              </Pressable>
            )}
          </View>

          {/* Filter button */}
          <Pressable
            style={({ pressed }) => [s.filterBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={4}
          >
            <Ionicons name="options-outline" size={18} color={MUTED_FG} />
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
  return (
    <View style={es.container}>
      {/* Glow orb illustration */}
      <BookmarkOrb />

      {/* Text */}
      <Text style={es.title}>
        {hasSearch ? 'No matches found' : 'No saved queries yet'}
      </Text>
      <Text style={es.desc}>
        {hasSearch
          ? 'Try a different search term.'
          : 'Use the bookmark icon in the editor\nto save a query.'}
      </Text>

      {/* Quick Tip card */}
      {!hasSearch && (
        <View style={es.tipCard}>
          {/* Icon box */}
          <LinearGradient
            colors={['#2D4CC8', '#1A3270']}
            style={es.tipIcon}
          >
            <Ionicons name="star" size={20} color="#FFFFFF" />
          </LinearGradient>

          {/* Text */}
          <View style={{ flex: 1 }}>
            <Text style={es.tipLabel}>Quick Tip</Text>
            <Text style={es.tipText}>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: FG,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 14,
    color: MUTED_FG,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: MUTED,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  tipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 3,
  },
  tipText: {
    fontSize: 13,
    color: MUTED_FG,
    lineHeight: 19,
  },
});

// ── Sheet styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    // Shadow for the sheet
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: HANDLE,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: FG,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MUTED,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 13,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: FG,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: MUTED,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
