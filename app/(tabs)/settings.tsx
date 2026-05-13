import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionRow } from "@/components/action-row";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { colors, controls, spacing, typography } from "@/constants/app-theme";
import { GUIDE_LABELS, GUIDE_TYPES } from "@/constants/camera-guides";
import { TRIP_CLIP_RATIOS, type TripClipRatio } from "@/constants/trip-clip";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  defaultAppSettings,
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  type ExportQuality,
  type FontSize,
  type FontStyle,
  type ThemeMode
} from "@/lib/app-settings";

type SettingKey =
  | "defaultGuide"
  | "guideVisible"
  | "guideSize"
  | "guideColor"
  | "overlayOpacity"
  | "defaultRatio"
  | "exportQuality"
  | "themeMode"
  | "fontStyle"
  | "fontSize";

const opacityOptions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];

const guideSizeOptions = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;

const guideColorOptions = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

const qualityOptions: {
  value: ExportQuality;
  label: string;
  detail: string;
}[] = [
  { value: "standard", label: "표준", detail: "가볍게 저장하고 빠르게 내보냅니다." },
  { value: "high", label: "높음", detail: "화질과 용량의 균형을 맞춥니다." },
  { value: "max", label: "최대", detail: "가장 높은 품질로 저장합니다." }
];

const qualityLabel: Record<ExportQuality, string> = {
  standard: "표준",
  high: "높음",
  max: "최대"
};

const themeOptions: {
  value: ThemeMode;
  label: string;
  detail: string;
}[] = [
  { value: "light", label: "라이트", detail: "밝은 흑백 화면으로 고정합니다." },
  { value: "dark", label: "다크", detail: "어두운 흑백 화면을 사용합니다." },
  { value: "system", label: "시스템", detail: "기기 화면 설정을 따릅니다." }
];

const themeLabel: Record<ThemeMode, string> = {
  light: "라이트",
  dark: "다크",
  system: "시스템"
};

const fontOptions: {
  value: FontStyle;
  label: string;
  detail: string;
}[] = [
  { value: "compact", label: "컴팩트", detail: "제목을 낮고 단정하게 표시합니다." },
  { value: "standard", label: "기본", detail: "읽기 편한 표준 크기로 표시합니다." },
  { value: "bold", label: "강조", detail: "큰 제목으로 화면 위계를 강하게 둡니다." }
];

const fontLabel: Record<FontStyle, string> = {
  compact: "컴팩트",
  standard: "기본",
  bold: "강조"
};

const fontSizeOptions: {
  value: FontSize;
  label: string;
  detail: string;
}[] = [
  { value: "small", label: "작게", detail: "정보가 많은 화면을 더 촘촘하게 봅니다." },
  { value: "medium", label: "기본", detail: "대부분의 화면에 맞는 표준 크기입니다." },
  { value: "large", label: "크게", detail: "제목과 설명을 더 크게 표시합니다." }
];

const fontSizeLabel: Record<FontSize, string> = {
  small: "작게",
  medium: "기본",
  large: "크게"
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [activeSetting, setActiveSetting] = useState<SettingKey | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSettings = async () => {
        const storedSettings = await getAppSettings();
        if (isActive) {
          setSettings(storedSettings);
        }
      };

      loadSettings();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const modalTitle = useMemo(() => {
    if (activeSetting === "defaultGuide") {
      return "기본 가이드";
    }

    if (activeSetting === "guideVisible") {
      return "가이드 표시";
    }

    if (activeSetting === "guideSize") {
      return "가이드 크기";
    }

    if (activeSetting === "guideColor") {
      return "가이드 색상";
    }

    if (activeSetting === "overlayOpacity") {
      return "오버레이 투명도";
    }

    if (activeSetting === "defaultRatio") {
      return "기본 비율";
    }

    if (activeSetting === "exportQuality") {
      return "저장 품질";
    }

    if (activeSetting === "themeMode") {
      return "화면 모드";
    }

    if (activeSetting === "fontStyle") {
      return "폰트 스타일";
    }

    if (activeSetting === "fontSize") {
      return "폰트 크기";
    }

    return "";
  }, [activeSetting]);

  const updateSetting = async (updates: Partial<AppSettings>) => {
    const nextSettings = {
      ...settings,
      ...updates
    };
    setSettings(nextSettings);
    await saveAppSettings(nextSettings);
    setActiveSetting(null);
  };

  return (
    <>
      <ScreenShell
        eyebrow="설정"
        title="기본값 설정"
        description="가이드, 오버레이, 저장 품질과 화면 스타일을 관리합니다."
        safeTop
      >
        <SectionBlock title="앱">
          <ActionRow
            label="화면 모드"
            detail="라이트, 다크, 시스템 설정"
            mark={themeLabel[settings.themeMode]}
            onPress={() => setActiveSetting("themeMode")}
          />
          <ActionRow
            label="폰트 스타일"
            detail="화면 제목의 크기와 밀도"
            mark={fontLabel[settings.fontStyle]}
            onPress={() => setActiveSetting("fontStyle")}
          />
          <ActionRow
            label="폰트 크기"
            detail="앱 화면의 글자 크기"
            mark={fontSizeLabel[settings.fontSize]}
            onPress={() => setActiveSetting("fontSize")}
          />
          <ActionRow label="화면 구성" detail="선, 여백, 타이포 중심의 정돈된 스타일" mark="간결" />
        </SectionBlock>

        <SectionBlock title="가이드">
          <ActionRow
            label="기본 가이드"
            detail="카메라를 열 때 먼저 표시할 구도 가이드"
            mark={GUIDE_LABELS[settings.defaultGuide]}
            onPress={() => setActiveSetting("defaultGuide")}
          />
          <ActionRow
            label="가이드 표시"
            detail="카메라, 사진 편집, 여행 클립에 같은 가이드 표시"
            mark={settings.guideVisible ? "켜짐" : "꺼짐"}
            onPress={() => setActiveSetting("guideVisible")}
          />
          <ActionRow
            label="가이드 크기"
            detail="모든 화면에서 사용할 가이드라인 크기"
            mark={String(settings.guideSize)}
            onPress={() => setActiveSetting("guideSize")}
          />
          <ActionRow
            label="가이드 색상"
            detail="모든 화면에서 사용할 가이드라인 색상"
            mark={guideColorOptions.find((option) => option.value === settings.guideColor)?.label ?? "사용자"}
            onPress={() => setActiveSetting("guideColor")}
          />
          <ActionRow
            label="오버레이 투명도"
            detail="이전 사진을 카메라 위에 표시할 기본 농도"
            mark={`${Math.round(settings.overlayOpacity * 100)}%`}
            onPress={() => setActiveSetting("overlayOpacity")}
          />
        </SectionBlock>

        <SectionBlock title="내보내기">
          <ActionRow
            label="기본 비율"
            detail="여행 클립을 열 때 먼저 선택되는 화면 비율"
            mark={settings.defaultRatio}
            onPress={() => setActiveSetting("defaultRatio")}
          />
          <ActionRow
            label="저장 품질"
            detail="편집 사진과 영상 업로드 이미지 압축 품질"
            mark={qualityLabel[settings.exportQuality]}
            onPress={() => setActiveSetting("exportQuality")}
          />
        </SectionBlock>
      </ScreenShell>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(activeSetting)}
        onRequestClose={() => setActiveSetting(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text selectable style={styles.modalTitle}>
                {modalTitle}
              </Text>
              <Pressable style={styles.closeButton} onPress={() => setActiveSetting(null)}>
                <Text selectable={false} style={styles.closeButtonText}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <View style={styles.optionList}>
              {activeSetting === "defaultGuide"
                ? GUIDE_TYPES.map((guide) => (
                    <OptionButton
                      key={guide}
                      label={GUIDE_LABELS[guide]}
                      detail="카메라 구도 가이드"
                      active={settings.defaultGuide === guide}
                      onPress={() => updateSetting({ defaultGuide: guide })}
                    />
                  ))
                : null}

              {activeSetting === "guideVisible" ? (
                <>
                  <OptionButton
                    label="켜짐"
                    detail="모든 구도 보조 화면에 가이드를 표시합니다."
                    active={settings.guideVisible}
                    onPress={() => updateSetting({ guideVisible: true })}
                  />
                  <OptionButton
                    label="꺼짐"
                    detail="구도 가이드를 숨긴 상태로 시작합니다."
                    active={!settings.guideVisible}
                    onPress={() => updateSetting({ guideVisible: false })}
                  />
                </>
              ) : null}

              {activeSetting === "guideSize"
                ? guideSizeOptions.map((size) => (
                    <OptionButton
                      key={size.value}
                      label={size.label}
                      detail={`${GUIDE_SIZE_MIN}-${GUIDE_SIZE_MAX} 범위의 공통 가이드 크기`}
                      active={settings.guideSize === size.value}
                      onPress={() => updateSetting({ guideSize: size.value, guideVisible: true })}
                    />
                  ))
                : null}

              {activeSetting === "guideColor"
                ? guideColorOptions.map((color) => (
                    <OptionButton
                      key={color.label}
                      label={color.label}
                      detail="카메라, 사진 편집, 여행 클립에 공통 적용"
                      active={settings.guideColor === color.value}
                      onPress={() => updateSetting({ guideColor: color.value, guideVisible: true })}
                    />
                  ))
                : null}

              {activeSetting === "overlayOpacity"
                ? opacityOptions.map((opacity) => (
                    <OptionButton
                      key={opacity}
                      label={`${Math.round(opacity * 100)}%`}
                      detail="이전 사진 오버레이 기본 투명도"
                      active={settings.overlayOpacity === opacity}
                      onPress={() => updateSetting({ overlayOpacity: opacity })}
                    />
                  ))
                : null}

              {activeSetting === "defaultRatio"
                ? TRIP_CLIP_RATIOS.map((ratio) => (
                    <OptionButton
                      key={ratio}
                      label={ratio}
                      detail="여행 클립 기본 화면 비율"
                      active={settings.defaultRatio === ratio}
                      onPress={() => updateSetting({ defaultRatio: ratio as TripClipRatio })}
                    />
                  ))
                : null}

              {activeSetting === "exportQuality"
                ? qualityOptions.map((quality) => (
                    <OptionButton
                      key={quality.value}
                      label={quality.label}
                      detail={quality.detail}
                      active={settings.exportQuality === quality.value}
                      onPress={() => updateSetting({ exportQuality: quality.value })}
                    />
                  ))
                : null}

              {activeSetting === "themeMode"
                ? themeOptions.map((theme) => (
                    <OptionButton
                      key={theme.value}
                      label={theme.label}
                      detail={theme.detail}
                      active={settings.themeMode === theme.value}
                      onPress={() => updateSetting({ themeMode: theme.value })}
                    />
                  ))
                : null}

              {activeSetting === "fontStyle"
                ? fontOptions.map((font) => (
                    <OptionButton
                      key={font.value}
                      label={font.label}
                      detail={font.detail}
                      active={settings.fontStyle === font.value}
                      onPress={() => updateSetting({ fontStyle: font.value })}
                    />
                  ))
                : null}

              {activeSetting === "fontSize"
                ? fontSizeOptions.map((fontSize) => (
                    <OptionButton
                      key={fontSize.value}
                      label={fontSize.label}
                      detail={fontSize.detail}
                      active={settings.fontSize === fontSize.value}
                      onPress={() => updateSetting({ fontSize: fontSize.value })}
                    />
                  ))
                : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function OptionButton({
  label,
  detail,
  active,
  onPress
}: {
  label: string;
  detail: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.option, active && styles.optionActive]} onPress={onPress}>
      <View style={styles.optionCopy}>
        <Text selectable style={[styles.optionLabel, active && styles.optionLabelActive]}>
          {label}
        </Text>
        <Text selectable style={[styles.optionDetail, active && styles.optionDetailActive]}>
          {detail}
        </Text>
      </View>
      <View style={[styles.optionMark, active && styles.optionMarkActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  modalPanel: {
    gap: 18,
    padding: spacing.screen,
    paddingBottom: spacing.section,
    borderTopWidth: 1,
    borderTopColor: colors.text,
    backgroundColor: colors.background
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    letterSpacing: 0
  },
  closeButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  closeButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionList: {
    gap: 8
  },
  option: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  optionActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  optionCopy: {
    flex: 1,
    gap: 4
  },
  optionLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  optionLabelActive: {
    color: colors.inverse
  },
  optionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  optionDetailActive: {
    color: "rgba(255, 255, 255, 0.74)"
  },
  optionMark: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: 999
  },
  optionMarkActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  }
});
