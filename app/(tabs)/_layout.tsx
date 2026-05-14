import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabGlyph } from "@/components/tab-glyph";
import { colors } from "@/constants/app-theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(insets.bottom + 10, 18);
  const tabBarHeight = 72 + tabBarBottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontSize: 14,
          fontWeight: "800"
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
          backgroundColor: colors.background,
          borderTopColor: colors.line
        },
        tabBarIconStyle: {
          marginTop: 2,
          marginBottom: 2
        },
        tabBarItemStyle: {
          minHeight: 54,
          paddingVertical: 3
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          lineHeight: 14,
          letterSpacing: 0
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          tabBarIcon: ({ focused }) => <TabGlyph kind="home" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "카메라",
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ focused }) => <TabGlyph kind="camera" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "스튜디오",
          tabBarIcon: ({ focused }) => <TabGlyph kind="studio" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ focused }) => <TabGlyph kind="settings" focused={focused} />
        }}
      />
    </Tabs>
  );
}
