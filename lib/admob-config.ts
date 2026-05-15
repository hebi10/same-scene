import Constants from "expo-constants";
import { Platform } from "react-native";

import { initializeNativeAdMob } from "@/lib/admob-native";

type AdMobExtra = {
  androidAppId?: string;
  androidBannerAdUnitId?: string;
};

const extra = Constants.expoConfig?.extra as
  | {
      admob?: AdMobExtra;
    }
  | undefined;

export const admobConfig = {
  androidAppId:
    extra?.admob?.androidAppId ?? "ca-app-pub-3239289311207399~9959086380",
  androidBannerAdUnitId:
    extra?.admob?.androidBannerAdUnitId ?? "ca-app-pub-3239289311207399/3281997392"
} as const;

export const getBannerAdUnitId = () =>
  Platform.OS === "android" ? admobConfig.androidBannerAdUnitId : null;

export const isAdMobConfigured = () =>
  Platform.OS === "android" && Boolean(admobConfig.androidBannerAdUnitId);

export const canUseNativeAdMob = () =>
  Platform.OS === "android" && Constants.appOwnership !== "expo";

export const initializeAdMob = async () => {
  if (!canUseNativeAdMob()) {
    return;
  }

  try {
    await initializeNativeAdMob();
  } catch {
    // Expo Go or builds without the native ad module should keep using the local placeholder.
  }
};
