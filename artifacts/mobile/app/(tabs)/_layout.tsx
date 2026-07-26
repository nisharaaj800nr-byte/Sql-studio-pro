import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Premium tab icon with gradient active pill ───────────────────────────────

function TabIcon({
  name,
  focused,
  color,
  label,
}: {
  name: IoniconName;
  focused: boolean;
  color: string;
  label: string;
}) {
  if (focused) {
    return (
      <View style={pill.container}>
        <LinearGradient
          colors={['#4B7BFF', '#7C5CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={pill.gradient}
        >
          <Ionicons name={name} size={20} color="#FFFFFF" />
        </LinearGradient>
        <View style={pill.dot} />
      </View>
    );
  }

  return (
    <View style={pill.inactiveWrap}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

const pill = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
    marginBottom: -2,
  },
  gradient: {
    width: 46,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4B7BFF',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4B7BFF',
  },
  inactiveWrap: {
    width: 46,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Tab layout ───────────────────────────────────────────────────────────────

export default function TabLayout() {
  const colors = useColors();
  const isDark = colors.isDark;
  const isIOS  = Platform.OS === 'ios';

  const tabBg = isDark ? '#0D1117' : colors.card;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   isDark ? '#4B7BFF' : colors.primary,
        tabBarInactiveTintColor: isDark ? '#4B5563' : colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS && isDark ? 'transparent' : tabBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : colors.border,
          elevation: 0,
          height: isIOS ? 80 : 64,
          paddingBottom: isIOS ? 22 : 8,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={isDark ? 80 : 95}
              tint={isDark ? 'dark' : 'light'}
              style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(13,17,23,0.85)' : undefined }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tabBg }]} />
          ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.1,
          marginTop: 0,
        },
        tabBarIconStyle:    { marginBottom: -2 },
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
              label="Home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="databases"
        options={{
          title: 'Database',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'server' : 'server-outline'}
              focused={focused}
              color={color}
              label="Database"
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
              label="Editor"
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
              label="Code"
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
              label="History"
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
              label="Settings"
            />
          ),
        }}
      />
    </Tabs>
  );
}
