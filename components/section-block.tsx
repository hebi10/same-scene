import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, typography } from "@/constants/app-theme";

type SectionBlockProps = {
  title: string;
  children: ReactNode;
};

export function SectionBlock({ title, children }: SectionBlockProps) {
  return (
    <View style={styles.section}>
      <Text selectable style={styles.title}>
        {title}
      </Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14
  },
  title: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  body: {
    gap: 8
  }
});
