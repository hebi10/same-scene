import type { ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/constants/app-theme";
import {
  defaultAppSettings,
  getFontSizeScale,
  getAppSettings,
  type FontSize,
  type FontStyle
} from "@/lib/app-settings";

type ScreenShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  safeTop?: boolean;
  children: ReactNode;
};

export function ScreenShell({
  eyebrow,
  title,
  description,
  safeTop = false,
  children
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const [fontStyle, setFontStyle] = useState<FontStyle>(defaultAppSettings.fontStyle);
  const [fontSize, setFontSize] = useState<FontSize>(defaultAppSettings.fontSize);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSettings = async () => {
        const settings = await getAppSettings();
        if (isActive) {
          setFontStyle(settings.fontStyle);
          setFontSize(settings.fontSize);
        }
      };

      loadSettings();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const sizeScale = getFontSizeScale(fontSize);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: safeTop ? insets.top + spacing.screen : spacing.screen,
          paddingBottom: insets.bottom + spacing.section * 2
        }
      ]}
    >
      <View style={styles.header}>
        {eyebrow ? (
          <Text selectable style={styles.eyebrow}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          selectable
          style={[
            styles.title,
            getTitleStyle(fontStyle, sizeScale)
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={[
              styles.description,
              {
                fontSize: Math.round(typography.body * sizeScale),
                lineHeight: Math.round(21 * sizeScale)
              }
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingTop: spacing.screen,
    paddingBottom: spacing.section * 2
  },
  header: {
    gap: 12
  },
  eyebrow: {
    color: colors.muted,
    fontSize: typography.eyebrow,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 36,
    letterSpacing: 0
  },
  description: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
    letterSpacing: 0
  }
});

const titleStyleByFont: Record<FontStyle, { fontSize: number; lineHeight: number }> = {
  standard: {
    fontSize: 28,
    lineHeight: 34
  },
  compact: {
    fontSize: 26,
    lineHeight: 32
  },
  bold: {
    fontSize: typography.title,
    lineHeight: 36
  }
};

const getTitleStyle = (fontStyle: FontStyle, scale: number) => {
  const style = titleStyleByFont[fontStyle];
  return {
    fontSize: Math.round(style.fontSize * scale),
    lineHeight: Math.round(style.lineHeight * scale)
  };
};
