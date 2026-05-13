import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronIcon } from "@/components/chevron-icon";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { colors, typography } from "@/constants/app-theme";

const homeHeroImage = require("../../assets/images/home-hero.png");

export default function HomeScreen() {
  return (
    <ScreenShell
      eyebrow="TravelFrame"
      title="여행 사진을 깔끔하게."
      description="같은 구도로 촬영하고, 사진과 짧은 여행 클립까지 정리합니다."
      safeTop
    >
      <View style={styles.preview}>
        <Image source={homeHeroImage} style={styles.heroImage} contentFit="cover" />
      </View>

      <SectionBlock title="시작하기">
        <View style={styles.startList}>
          <HomeAction
            step="01"
            href="/camera"
            label="카메라 열기"
            detail="중앙 가이드와 이전 사진 오버레이로 촬영"
          />
          <HomeAction
            step="02"
            href="/studio"
            label="스튜디오 열기"
            detail="촬영 사진 확인, 편집, 영상 후보 관리"
          />
          <HomeAction
            step="03"
            href="/trip-clip"
            label="여행 클립 만들기"
            detail="사진 순서, 템플릿, 음악 미리보기"
            isLast
          />
        </View>
      </SectionBlock>
    </ScreenShell>
  );
}

function HomeAction({
  step,
  href,
  label,
  detail,
  isLast = false
}: {
  step: string;
  href: Href;
  label: string;
  detail: string;
  isLast?: boolean;
}) {
  const router = useRouter();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionItem,
        !isLast && styles.actionDivider,
        pressed && styles.actionPressed
      ]}
      onPress={() => router.push(href)}
    >
      <View style={styles.actionStepBox}>
        <Text selectable={false} style={styles.actionStep}>
          {step}
        </Text>
      </View>
      <View style={styles.actionCopy}>
        <Text selectable style={styles.actionLabel}>
          {label}
        </Text>
        <Text selectable style={styles.actionDetail}>
          {detail}
        </Text>
      </View>
      <View style={styles.actionArrow}>
        <ChevronIcon size={10} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: "center",
    paddingVertical: 4
  },
  heroImage: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#F5F5F2"
  },
  startList: {
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  actionItem: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 14
  },
  actionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  actionPressed: {
    backgroundColor: colors.surfaceStrong
  },
  actionStepBox: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  actionStep: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  actionLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  actionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  actionArrow: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
});
