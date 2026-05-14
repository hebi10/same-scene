import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { colors, typography } from "@/constants/app-theme";

const homeSlides: {
  image: number;
  href: Href;
  label: string;
  detail: string;
}[] = [
  {
    image: require("../../assets/images/home-slide-camera.png"),
    href: "/camera",
    label: "카메라 열기",
    detail: "중앙 가이드와 이전 사진 오버레이로 같은 구도를 맞춰 촬영합니다."
  },
  {
    image: require("../../assets/images/home-slide-edit.png"),
    href: "/studio",
    label: "사진 편집",
    detail: "촬영한 사진의 비율, 위치, 회전을 정리하고 저장합니다."
  },
  {
    image: require("../../assets/images/home-slide-video.png"),
    href: "/trip-clip",
    label: "영상 만들기",
    detail: "여러 사진의 순서와 전환을 정해 짧은 영상으로 저장합니다."
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeSlide, setActiveSlide] = useState(0);
  const slideWidth = Math.min(width - 44, 360);

  const handleSlideScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveSlide(Math.max(0, Math.min(homeSlides.length - 1, nextIndex)));
  };

  return (
    <ScreenShell
      eyebrow="트래블프레임"
      title="여행 사진을 깔끔하게."
      description="같은 구도로 촬영하고, 사진과 짧은 여행 클립까지 정리합니다."
      safeTop
    >
      <View style={[styles.preview, { width: slideWidth }]}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={slideWidth}
          decelerationRate="fast"
          onMomentumScrollEnd={handleSlideScroll}
          style={styles.heroScroller}
          contentContainerStyle={styles.heroTrack}
        >
          {homeSlides.map((slide) => (
            <Pressable
              key={slide.label}
              accessibilityRole="button"
              accessibilityLabel={`${slide.label} 화면으로 이동`}
              style={({ pressed }) => [
                styles.heroSlide,
                { width: slideWidth },
                pressed && styles.heroPressed
              ]}
              onPress={() => router.push(slide.href)}
            >
              <Image source={slide.image} style={styles.heroImage} contentFit="cover" />
              <View style={styles.heroCopy}>
                <View style={styles.heroCopyHeader}>
                  <Text selectable style={styles.heroLabel}>
                    {slide.label}
                  </Text>
                  <Text selectable={false} style={styles.heroArrow}>
                    이동
                  </Text>
                </View>
                <Text selectable style={styles.heroDetail}>
                  {slide.detail}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.heroDots} pointerEvents="none">
          {homeSlides.map((slide, index) => (
            <View
              key={slide.label}
              style={[styles.heroDot, activeSlide === index && styles.heroDotActive]}
            />
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: 4
  },
  heroScroller: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: colors.background
  },
  heroTrack: {
    alignItems: "center"
  },
  heroSlide: {
    backgroundColor: colors.background
  },
  heroPressed: {
    opacity: 0.9
  },
  heroImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F5F5F2"
  },
  heroCopy: {
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  heroCopyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  heroLabel: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 20,
    letterSpacing: 0
  },
  heroArrow: {
    minWidth: 48,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.inverse,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textAlign: "center",
    letterSpacing: 0,
    backgroundColor: colors.text
  },
  heroDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  heroDots: {
    position: "absolute",
    bottom: 18,
    left: 16,
    flexDirection: "row",
    gap: 6
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  heroDotActive: {
    width: 18,
    backgroundColor: colors.text
  }
});

