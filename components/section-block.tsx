import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

type SectionBlockProps = {
  title: string;
  children: ReactNode;
};

export function SectionBlock({ title, children }: SectionBlockProps) {
  const { palette, layoutScale } = useAppAppearance();

  return (
    <View style={[styles.section, { gap: Math.round(14 * layoutScale) }]}>
      <Text selectable style={[styles.title, { color: palette.text }]}>
        {title}
      </Text>
      <View style={[styles.body, { gap: Math.round(8 * layoutScale) }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14
  },
  title: {
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  body: {
    gap: 8
  }
});
