import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface FABProps {
  icon: IconName;
  label?: string;
  onPress: () => void;
  color?: string;
  bottom?: number;
}

export function FAB({ icon, label, onPress, color, bottom }: FABProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bgColor = color ?? colors.primary;

  // Tab bar height: iOS ≈ 49pt bar + safe area, Android/web fixed 56pt
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 56;
  const fabBottom = (bottom ?? 0) + insets.bottom + TAB_BAR_HEIGHT + 16;

  return (
    <View style={[styles.wrapper, { bottom: fabBottom }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          label ? styles.extended : styles.circle,
          {
            backgroundColor: bgColor,
            opacity: pressed ? 0.88 : 1,
            shadowColor: bgColor,
          },
        ]}
      >
        <MaterialIcons name={icon} size={22} color="#FFFFFF" />
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 6,
  },
  circle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
  },
  extended: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 27,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
