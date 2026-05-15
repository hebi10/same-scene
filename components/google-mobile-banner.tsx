import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

type GoogleMobileBannerProps = {
  adUnitId: string;
};

export function GoogleMobileBanner({ adUnitId }: GoogleMobileBannerProps) {
  const unitId = __DEV__ ? TestIds.BANNER : adUnitId;

  return (
    <BannerAd
      unitId={unitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  );
}

