export const ADMOB_TEST_INTERSTITIAL_AD_UNIT_ID =
  "ca-app-pub-3940256099942544/1033173712";

type ResolveInterstitialAdUnitIdInput = {
  isAndroid: boolean;
  isDev: boolean;
  androidInterstitialAdUnitId?: string | null;
};

export const resolveInterstitialAdUnitId = ({
  isAndroid,
  isDev,
  androidInterstitialAdUnitId
}: ResolveInterstitialAdUnitIdInput) => {
  if (!isAndroid) {
    return null;
  }

  if (isDev) {
    return ADMOB_TEST_INTERSTITIAL_AD_UNIT_ID;
  }

  const configuredUnitId = androidInterstitialAdUnitId?.trim();
  return configuredUnitId ? configuredUnitId : null;
};
