import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth-context";
import { useAppAppearance } from "@/lib/app-appearance";

function AppStack() {
  const { palette, effectiveThemeMode } = useAppAppearance();

  return (
    <>
      <Stack
        screenOptions={{
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerTitleStyle: {
            fontSize: 14,
            fontWeight: "800"
          },
          contentStyle: { backgroundColor: palette.background }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edit" options={{ title: "사진 편집", headerShown: false }} />
        <Stack.Screen name="photo/[id]" options={{ title: "사진" }} />
        <Stack.Screen name="trip-clip" options={{ title: "여행 클립" }} />
        <Stack.Screen
          name="capture-preview"
          options={{ title: "미리보기", headerShown: false }}
        />
      </Stack>
      <StatusBar style={effectiveThemeMode === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <AppStack />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
