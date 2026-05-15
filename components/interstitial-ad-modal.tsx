import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { controls, spacing, typography } from "@/constants/app-theme";
import { getAdPlacementLabel, type AdPlacement, shouldShowAds } from "@/lib/ad-entitlement";
import { isAdMobConfigured } from "@/lib/admob-config";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";

type InterstitialAdModalProps = {
  visible: boolean;
  placement: AdPlacement;
  onClose: () => void;
};

export function InterstitialAdModal({
  visible,
  placement,
  onClose
}: InterstitialAdModalProps) {
  const { subscription } = useAuth();
  const { palette } = useAppAppearance();
  const configured = isAdMobConfigured();

  if (!shouldShowAds(subscription)) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.panel,
            {
              borderColor: palette.text,
              backgroundColor: palette.background
            }
          ]}
        >
          <Text selectable={false} style={[styles.eyebrow, { color: palette.muted }]}>
            광고
          </Text>
          <Text selectable style={[styles.title, { color: palette.text }]}>
            {getAdPlacementLabel(placement)}
          </Text>
          <View style={[styles.creative, { borderColor: palette.line, backgroundColor: palette.surface }]}>
            <Text selectable style={[styles.creativeText, { color: palette.text }]}>
              트래블프레임 무료 버전 광고 영역
            </Text>
            <Text selectable style={[styles.creativeDetail, { color: palette.muted }]}>
              {configured
                ? "AdMob 앱 ID와 Android 배너 단위가 프로젝트에 연결되었습니다."
                : "광고 제거 결제 또는 영상 내보내기 플랜을 이용하면 이 화면은 표시되지 않습니다."}
            </Text>
          </View>
          <Pressable style={[styles.closeButton, { backgroundColor: palette.text }]} onPress={onClose}>
            <Text selectable={false} style={[styles.closeButtonText, { color: palette.inverse }]}>
              계속하기
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.screen,
    backgroundColor: "rgba(0,0,0,0.28)"
  },
  panel: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 14,
    padding: 18,
    borderWidth: 1
  },
  eyebrow: {
    fontSize: typography.eyebrow,
    fontWeight: "900",
    letterSpacing: 0
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    letterSpacing: 0
  },
  creative: {
    minHeight: 150,
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderWidth: 1
  },
  creativeText: {
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0
  },
  creativeDetail: {
    fontSize: typography.small,
    lineHeight: 18,
    textAlign: "center",
    letterSpacing: 0
  },
  closeButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center"
  },
  closeButtonText: {
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  }
});
