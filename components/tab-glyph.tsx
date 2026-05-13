import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/app-theme";

type TabGlyphProps = {
  kind: "home" | "camera" | "studio" | "settings";
  focused: boolean;
};

export function TabGlyph({ kind, focused }: TabGlyphProps) {
  const strokeStyle = focused ? styles.strokeActive : styles.stroke;

  return (
    <View style={[styles.glyph, focused && styles.focused]}>
      {kind === "home" ? (
        <View style={styles.homeIcon}>
          <View style={[styles.homeRoof, strokeStyle]} />
          <View style={[styles.homeBody, strokeStyle]} />
        </View>
      ) : null}
      {kind === "camera" ? (
        <View style={[styles.cameraRing, strokeStyle]}>
          <View style={[styles.cameraDot, focused && styles.dotActive]} />
        </View>
      ) : null}
      {kind === "studio" ? (
        <View style={styles.gridIcon}>
          <View style={[styles.gridCell, strokeStyle]} />
          <View style={[styles.gridCell, strokeStyle]} />
          <View style={[styles.gridCell, strokeStyle]} />
          <View style={[styles.gridCell, strokeStyle]} />
        </View>
      ) : null}
      {kind === "settings" ? (
        <View style={styles.settingsIcon}>
          <View style={[styles.settingLine, strokeStyle]} />
          <View style={[styles.settingLine, styles.settingLineShort, strokeStyle]} />
          <View style={[styles.settingLine, strokeStyle]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  focused: {
    backgroundColor: colors.ink
  },
  stroke: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  strokeActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  cameraRing: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  cameraDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.text
  },
  dotActive: {
    backgroundColor: colors.inverse
  },
  homeIcon: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  homeRoof: {
    width: 12,
    height: 2,
    transform: [{ rotate: "-45deg" }],
    marginBottom: -1
  },
  homeBody: {
    width: 12,
    height: 9
  },
  gridIcon: {
    width: 14,
    height: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2
  },
  gridCell: {
    width: 6,
    height: 6
  },
  settingsIcon: {
    width: 15,
    gap: 3
  },
  settingLine: {
    height: 2,
    width: 15
  },
  settingLineShort: {
    width: 10,
    alignSelf: "flex-end"
  }
});
