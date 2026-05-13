import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/app-theme";

type ChevronIconProps = {
  color?: string;
  size?: number;
};

export function ChevronIcon({ color = colors.inverse, size = 14 }: ChevronIconProps) {
  const lineWidth = Math.max(7, size * 0.62);

  return (
    <View style={[styles.chevron, { width: size, height: size }]}>
      <View
        style={[
          styles.line,
          styles.lineTop,
          {
            width: lineWidth,
            backgroundColor: color
          }
        ]}
      />
      <View
        style={[
          styles.line,
          styles.lineBottom,
          {
            width: lineWidth,
            backgroundColor: color
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chevron: {
    alignItems: "center",
    justifyContent: "center"
  },
  line: {
    position: "absolute",
    height: 2
  },
  lineTop: {
    transform: [{ translateY: -2.5 }, { rotate: "45deg" }]
  },
  lineBottom: {
    transform: [{ translateY: 2.5 }, { rotate: "-45deg" }]
  }
});
