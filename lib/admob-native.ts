import mobileAds from "react-native-google-mobile-ads";

export const initializeNativeAdMob = async () => {
  await mobileAds().initialize();
};

