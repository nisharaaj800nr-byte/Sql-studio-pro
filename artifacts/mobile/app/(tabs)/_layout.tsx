import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

// iOS 26: NativeTabs with liquid glass. All 6 tabs registered.
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="databases">
        <Icon sf={{ default: 'cylinder', selected: 'cylinder.fill' }} />
        <Label>Databases</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="editor">
        <Icon sf={{ default: 'terminal', selected: 'terminal.fill' }} />
        <Label>Editor</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="code">
        <Icon sf={{ default: 'chevron.left.forwardslash.chevron.right', selected: 'chevron.left.forwardslash.chevron.right' }} />
        <Label>Code</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: 'clock', selected: 'clock.fill' }} />
        <Label>History</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        // headerShown: false — every screen owns its own header + safe-area padding
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
            />
          ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 1,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="house.fill" tintColor={color} size={size - 2} />
            ) : (
              <MaterialCommunityIcons name="home" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="databases"
        options={{
          title: 'Databases',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="cylinder.fill" tintColor={color} size={size - 2} />
            ) : (
              <MaterialCommunityIcons name="database" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: 'Editor',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="terminal" tintColor={color} size={size - 2} />
            ) : (
              <MaterialCommunityIcons name="code-braces" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="code"
        options={{
          title: 'Code',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView
                name="chevron.left.forwardslash.chevron.right"
                tintColor={color}
                size={size - 2}
              />
            ) : (
              <MaterialCommunityIcons name="xml" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={size - 2} />
            ) : (
              <MaterialIcons name="history" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="gearshape.fill" tintColor={color} size={size - 2} />
            ) : (
              <MaterialIcons name="settings" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
