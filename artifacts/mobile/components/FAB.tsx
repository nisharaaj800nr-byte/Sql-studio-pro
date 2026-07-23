import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

  return (
    <View style={[styles.wrapper, { bottom: (bottom ?? 0) + insets.bottom + 90 }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: bgColor,
            opacity: pressed ? 0.85 : 1,
            shadowColor: bgColor,
          },
          label ? styles.extended : styles.circle,
        ]}
      >
        <MaterialIcons name={icon} size={22} color="#FFFFFF" />
        {label ? (
          <Text style={styles.label}>{label}</Text>
        ) : null}
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
  },
  extended: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
