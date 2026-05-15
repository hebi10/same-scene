type ShowGoogleMobileInterstitialAdInput = {
  onComplete: () => void;
};

export const showGoogleMobileInterstitialAd = ({
  onComplete
}: ShowGoogleMobileInterstitialAdInput) => {
  onComplete();
  return () => undefined;
};
