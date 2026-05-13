import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronIcon } from "@/components/chevron-icon";
import { colors, controls, typography } from "@/constants/app-theme";

type ActionRowProps = {
  href?: Href;
  label: string;
  detail?: string;
  mark?: string;
  onPress?: () => void;
};

export function ActionRow({ href, label, detail, mark = ">", onPress }: ActionRowProps) {
  const content = (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.copy}>
        <Text selectable style={styles.label}>
          {label}
        </Text>
        {detail ? (
          <Text selectable style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.markBox}>
        {mark === ">" ? (
          <ChevronIcon size={10} />
        ) : (
          <Text selectable={false} style={styles.markText}>
            {mark}
          </Text>
        )}
      </View>
    </Pressable>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} asChild>
      {content}
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 96,
    paddingVertical: 15,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  pressed: {
    opacity: 0.55
  },
  copy: {
    gap: 4
  },
  label: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 21,
    letterSpacing: 0
  },
  detail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  markBox: {
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  markText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: 0
  }
});
