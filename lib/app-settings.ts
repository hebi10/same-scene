import AsyncStorage from "@react-native-async-storage/async-storage";

import type { GuideType } from "@/constants/camera-guides";
import type { TripClipRatio } from "@/constants/trip-clip";

const APP_SETTINGS_KEY = "travel-frame.settings.v1";

export type ExportQuality = "standard" | "high" | "max";
export type ThemeMode = "light" | "dark" | "system";
export type FontStyle = "standard" | "compact" | "bold";
export type FontSize = "small" | "medium" | "large";

export const GUIDE_SIZE_MIN = 24;
export const GUIDE_SIZE_MAX = 86;
export const DEFAULT_GUIDE_COLOR = "rgba(255, 255, 255, 0.78)";

export type AppSettings = {
  defaultGuide: GuideType;
  guideVisible: boolean;
  guideSize: number;
  guideColor: string;
  overlayOpacity: number;
  defaultRatio: TripClipRatio;
  exportQuality: ExportQuality;
  themeMode: ThemeMode;
  fontStyle: FontStyle;
  fontSize: FontSize;
};

export const defaultAppSettings: AppSettings = {
  defaultGuide: "circle",
  guideVisible: true,
  guideSize: 44,
  guideColor: DEFAULT_GUIDE_COLOR,
  overlayOpacity: 0.4,
  defaultRatio: "9:16",
  exportQuality: "high",
  themeMode: "light",
  fontStyle: "compact",
  fontSize: "medium"
};

const clampGuideSize = (value: unknown) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return defaultAppSettings.guideSize;
  }

  return Math.round(Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, parsedValue)));
};

const normalizeSettings = (value: Partial<AppSettings> | null): AppSettings => {
  const nextSettings = {
    ...defaultAppSettings,
    ...(value ?? {})
  };

  return {
    ...nextSettings,
    guideVisible:
      typeof nextSettings.guideVisible === "boolean"
        ? nextSettings.guideVisible
        : defaultAppSettings.guideVisible,
    guideSize: clampGuideSize(nextSettings.guideSize),
    guideColor:
      typeof nextSettings.guideColor === "string" && nextSettings.guideColor.trim()
        ? nextSettings.guideColor
        : defaultAppSettings.guideColor
  };
};

export const getAppSettings = async () => {
  const value = await AsyncStorage.getItem(APP_SETTINGS_KEY);

  if (!value) {
    return defaultAppSettings;
  }

  try {
    return normalizeSettings(JSON.parse(value) as Partial<AppSettings>);
  } catch {
    return defaultAppSettings;
  }
};

export const saveAppSettings = async (settings: AppSettings) => {
  await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
};

export const updateAppSettings = async (updates: Partial<AppSettings>) => {
  const current = await getAppSettings();
  return saveAppSettings({
    ...current,
    ...updates
  });
};

export const getExportQualityCompression = (quality: ExportQuality) => {
  if (quality === "max") {
    return 0.98;
  }

  if (quality === "standard") {
    return 0.86;
  }

  return 0.94;
};

export const getUploadCompression = (quality: ExportQuality) => {
  if (quality === "max") {
    return 0.92;
  }

  if (quality === "standard") {
    return 0.8;
  }

  return 0.86;
};

export const getFontSizeScale = (fontSize: FontSize) => {
  if (fontSize === "small") {
    return 0.92;
  }

  if (fontSize === "large") {
    return 1.1;
  }

  return 1;
};
