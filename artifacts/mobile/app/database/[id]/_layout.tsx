import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function DatabaseLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerBackTitle: 'Back',
        headerShadowVisible: false,
      }}
    />
  );
}
