import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

interface FABProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  color?: string;
  label?: string;
}

export function FAB({ icon, onPress, color, label }: FABProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 58;

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, []);

  const bgColor = color ?? colors.primary;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + TAB_BAR_HEIGHT + 16,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        style={({ pressed }) => [
          styles.fab,
          label ? styles.fabExtended : undefined,
          {
            backgroundColor: bgColor,
            shadowColor: bgColor,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <Ionicons name={icon} size={22} color="#fff" />
        {label ? (
          <Text style={styles.label}>{label}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 18,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabExtended: {
    width: 'auto',
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
