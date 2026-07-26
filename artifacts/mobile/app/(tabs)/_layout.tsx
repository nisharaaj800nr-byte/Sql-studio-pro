import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Premium glow pill for selected tab
function TabIcon({
  name,
  focused,
  color,
}: {
  name: IoniconName;
  focused: boolean;
  color: string;
}) {
  return (
    <View
      style={[
        focused ? pill.wrap : undefined,
        focused ? { backgroundColor: color + '22' } : undefined,
      ]}
    >
      <Ionicons name={name} size={22} color={color} />
      {focused && (
        <View style={[pill.dot, { backgroundColor: color }]} />
      )}
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: {
    minWidth: 44,
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export default function TabLayout() {
  const colors = useColors();
  const isDark = colors.isDark;
  const isIOS  = Platform.OS === 'ios';

  // Premium dark tab bar colour
  const tabBg = isDark ? '#0D1117' : colors.card;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   isDark ? '#4F8DFF' : colors.primary,
        tabBarInactiveTintColor: isDark ? '#4B5563' : colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: tabBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : colors.border,
          elevation: 0,
          height: isIOS ? 78 : 64,
          paddingBottom: isIOS ? 20 : 8,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={isDark ? 80 : 95}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tabBg }]} />
          ),
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarIconStyle:    { marginBottom: -1 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="databases"
        options={{
          title: 'Databases',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'server' : 'server-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: 'SQL Editor',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'terminal' : 'terminal-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="code"
        options={{
          title: 'Code',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'code-slash' : 'code-slash-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'time' : 'time-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
