import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";

type ShowGoogleMobileInterstitialAdInput = {
  adUnitId: string;
  onComplete: () => void;
};

export const showGoogleMobileInterstitialAd = ({
  adUnitId,
  onComplete
}: ShowGoogleMobileInterstitialAdInput) => {
  let completed = false;
  const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true
  });
  const unsubscribers: (() => void)[] = [];

  const cleanup = () => {
    while (unsubscribers.length > 0) {
      unsubscribers.pop()?.();
    }
  };

  const complete = () => {
    if (completed) {
      return;
    }

    completed = true;
    cleanup();
    onComplete();
  };

  unsubscribers.push(
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      try {
        const result = interstitial.show();
        void Promise.resolve(result).catch(complete);
      } catch {
        complete();
      }
    }),
    interstitial.addAdEventListener(AdEventType.CLOSED, complete),
    interstitial.addAdEventListener(AdEventType.ERROR, complete)
  );

  try {
    interstitial.load();
  } catch {
    complete();
  }

  return () => {
    if (completed) {
      return;
    }

    completed = true;
    cleanup();
  };
};
