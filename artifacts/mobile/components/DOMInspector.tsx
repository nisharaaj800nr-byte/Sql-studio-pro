/**
 * DOMInspector — Phase 3.2 (HTML DOM inspector)
 * Collapsible element tree + attribute/style details panel.
 * Receives a serialized DOM tree from WebPreview via postMessage.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DOMNode {
  tag: string;                       // lowercase tag name, or '#text'
  attrs: Record<string, string>;     // element attributes
  children: DOMNode[];
  text?: string;                     // trimmed text content (leaf text nodes)
}

// ── Flatten tree for rendering ────────────────────────────────────────────────

interface FlatItem {
  node: DOMNode;
  depth: number;
  key: string;
  parentKey: string;
  hasChildren: boolean;
}

function flattenTree(
  node: DOMNode,
  depth: number,
  parentKey: string,
  index: number,
  collapsed: Set<string>,
  out: FlatItem[],
): void {
  const key = `${parentKey}/${index}`;
  const hasChildren = node.children.length > 0;
  out.push({ node, depth, key, parentKey, hasChildren });

  if (hasChildren && !collapsed.has(key)) {
    node.children.forEach((child, i) => flattenTree(child, depth + 1, key, i, collapsed, out));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function attrString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => v ? `${k}="${v}"` : k)
    .join(' ');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TreeRow({
  item,
  isSelected,
  onSelect,
  onToggle,
  colors,
}: {
  item: FlatItem;
  isSelected: boolean;
  onSelect: (key: string) => void;
  onToggle: (key: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { node, depth, key, hasChildren } = item;
  const isText = node.tag === '#text';

  const tagColor   = isText ? colors.mutedForeground : colors.sqlKeyword;
  const attrColor  = colors.sqlString;

  const indent = depth * 14;

  return (
    <Pressable
      onPress={() => { onSelect(key); }}
      style={[
        styles.row,
        { paddingLeft: 8 + indent, borderBottomColor: colors.border + '40' },
        isSelected && { backgroundColor: colors.primary + '18' },
      ]}
    >
      {/* Expand/collapse chevron */}
      <View style={styles.chevronWrap}>
        {hasChildren ? (
          <Pressable onPress={() => onToggle(key)} hitSlop={8}>
            <MaterialIcons
              name={item.hasChildren ? 'chevron-right' : 'expand-more'}
              size={14}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : (
          <View style={{ width: 14 }} />
        )}
      </View>

      {/* Node label */}
      {isText ? (
        <Text style={[styles.textNode, { color: tagColor }]} numberOfLines={1}>
          "{node.text}"
        </Text>
      ) : (
        <Text style={[styles.tag, { color: tagColor }]} numberOfLines={1}>
          {'<'}
          <Text style={{ color: tagColor, fontWeight: '700' }}>{node.tag}</Text>
          {Object.keys(node.attrs).length > 0 && (
            <Text style={{ color: attrColor, fontWeight: '400' }}>
              {' '}{attrString(node.attrs).slice(0, 60)}
            </Text>
          )}
          {hasChildren ? '>' : ' />'}
        </Text>
      )}

      {isSelected && (
        <MaterialIcons name="arrow-left" size={12} color={colors.primary} style={{ marginLeft: 'auto', marginRight: 4 }} />
      )}
    </Pressable>
  );
}

function DetailsPanel({
  node,
  colors,
}: {
  node: DOMNode;
  colors: ReturnType<typeof useColors>;
}) {
  const isText = node.tag === '#text';
  const attrs  = Object.entries(node.attrs);

  return (
    <View style={[styles.details, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      {/* Tag header */}
      <View style={[styles.detailsHeader, { borderBottomColor: colors.border }]}>
        <MaterialIcons name="code" size={13} color={colors.primary} />
        <Text style={[styles.detailsTitle, { color: colors.foreground }]}>
          {isText ? '#text' : `<${node.tag}>`}
        </Text>
      </View>

      <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
        {isText ? (
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsKey, { color: colors.mutedForeground }]}>content</Text>
            <Text style={[styles.detailsVal, { color: colors.foreground }]} selectable>
              {node.text ?? ''}
            </Text>
          </View>
        ) : attrs.length === 0 ? (
          <Text style={[styles.noAttrs, { color: colors.mutedForeground }]}>No attributes</Text>
        ) : (
          attrs.map(([k, v]) => (
            <View key={k} style={[styles.detailsRow, { borderBottomColor: colors.border + '50' }]}>
              <Text style={[styles.detailsKey, { color: colors.sqlFunction }]}>{k}</Text>
              <Text style={[styles.detailsVal, { color: colors.foreground }]} selectable numberOfLines={3}>
                {v || '(empty)'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DOMInspectorProps {
  tree: DOMNode | null;
}

export function DOMInspector({ tree }: DOMInspectorProps) {
  const colors = useColors();
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const handleToggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelect = useCallback((key: string) => {
    setSelectedKey(prev => prev === key ? null : key);
  }, []);

  if (!tree) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <MaterialIcons name="developer-mode" size={14} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>DOM Inspector</Text>
        </View>
        <View style={styles.empty}>
          <MaterialIcons name="layers" size={28} color={colors.mutedForeground} style={{ opacity: 0.35 }} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Waiting for preview…</Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            DOM tree appears once the HTML preview loads
          </Text>
        </View>
      </View>
    );
  }

  // Flatten visible tree
  const flat: FlatItem[] = [];
  flattenTree(tree, 0, '', 0, collapsed, flat);

  // Find selected node
  const selectedItem = selectedKey ? flat.find(f => f.key === selectedKey) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <MaterialIcons name="developer-mode" size={14} color={colors.primary} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>DOM Inspector</Text>
        <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>
          {flat.length} node{flat.length !== 1 ? 's' : ''}
        </Text>
        {selectedKey && (
          <Pressable onPress={() => setSelectedKey(null)} hitSlop={8} style={{ marginLeft: 'auto' }}>
            <MaterialIcons name="close" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Tree */}
      <ScrollView
        style={styles.tree}
        showsVerticalScrollIndicator={false}
      >
        {flat.map(item => (
          <TreeRow
            key={item.key}
            item={item}
            isSelected={item.key === selectedKey}
            onSelect={handleSelect}
            onToggle={handleToggle}
            colors={colors}
          />
        ))}
      </ScrollView>

      {/* Details panel — shown when a node is selected */}
      {selectedItem && (
        <DetailsPanel node={selectedItem.node} colors={colors} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const MONO = 'monospace';

const styles = StyleSheet.create({
  container:    { flex: 1, overflow: 'hidden', borderTopWidth: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  headerCount:  { fontSize: 11, marginLeft: 4 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 24 },
  emptyText:    { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  emptyHint:    { fontSize: 11, opacity: 0.5, textAlign: 'center', paddingHorizontal: 24 },
  tree:         { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  chevronWrap: { width: 16, alignItems: 'center' },
  tag:          { flex: 1, fontFamily: MONO, fontSize: 11.5, lineHeight: 16 },
  textNode:     { flex: 1, fontFamily: MONO, fontSize: 11, fontStyle: 'italic', lineHeight: 16 },
  details:      { maxHeight: 140, borderTopWidth: 1 },
  detailsHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  detailsTitle: { fontSize: 12, fontWeight: '700', fontFamily: MONO },
  detailsScroll:{ maxHeight: 100 },
  detailsRow:   { flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth },
  detailsKey:   { fontSize: 11, fontFamily: MONO, fontWeight: '600', minWidth: 72 },
  detailsVal:   { flex: 1, fontSize: 11, fontFamily: MONO },
  noAttrs:      { padding: 12, fontSize: 12, fontStyle: 'italic' },
});
