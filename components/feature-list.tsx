import { StyleSheet, Text, View } from "react-native";

import { colors, typography } from "@/constants/app-theme";
import type { FeatureGroup } from "@/constants/feature-groups";

type FeatureListProps = {
  group: FeatureGroup;
};

export function FeatureList({ group }: FeatureListProps) {
  return (
    <View style={styles.section}>
      <Text selectable style={styles.sectionTitle}>
        {group.title}
      </Text>
      <View style={styles.items}>
        {group.items.map((item) => (
          <View key={item} style={styles.item}>
            <Text selectable style={styles.itemText}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  items: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  item: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  itemText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 21,
    letterSpacing: 0
  }
});
