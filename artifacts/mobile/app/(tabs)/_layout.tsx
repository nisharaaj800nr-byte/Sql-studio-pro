import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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
    <View style={focused ? iconStyles.activeWrapper : undefined}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  activeWrapper: {
    minWidth: 42,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function TabLayout() {
  const colors = useColors();
  const isDark = colors.isDark;
  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          height: isIOS ? 76 : 64,
          paddingBottom: isIOS ? 19 : 8,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={95}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card },
              ]}
            />
          ),
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarIconStyle: { marginBottom: -1 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'home' : 'home-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="databases"
        options={{
          title: 'Databases',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'server' : 'server-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: 'Editor',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'terminal' : 'terminal-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="code"
        options={{
          title: 'Code',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'code-slash' : 'code-slash-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'time' : 'time-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'settings' : 'settings-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
