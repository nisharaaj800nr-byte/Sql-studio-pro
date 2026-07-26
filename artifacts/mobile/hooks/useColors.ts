import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Returns design tokens for the current color scheme.
 * Respects the in-app theme setting (dark / light / system).
 * Falls back to dark when setting is 'system' and OS reports null.
 */
export function useColors() {
  const systemScheme = useColorScheme();
  const { themeMode } = useTheme();

  const effectiveScheme: 'dark' | 'light' =
    themeMode === 'system'
      ? (systemScheme ?? 'dark')
      : themeMode;

  const palette =
    effectiveScheme === 'dark'
      ? (colors as unknown as Record<string, typeof colors.light>).dark
      : colors.light;

  return { ...palette, radius: colors.radius, isDark: effectiveScheme === 'dark' };
}
