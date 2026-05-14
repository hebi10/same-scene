import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { colors, controls, spacing, typography } from "@/constants/app-theme";
import {
  DELETE_ACCOUNT_REQUEST_URL,
  PRIVACY_POLICY_URL
} from "@/constants/legal-links";
import { useAuth } from "@/lib/auth-context";
import { getPhotos } from "@/lib/photo-library";
import { getMadeVideos } from "@/lib/video-library";
import { getImageBundleWorks } from "@/lib/work-library";
import {
  deleteUserMusicTrack,
  pickAndUploadUserMusicTrack,
  syncUserMusicTracks,
  USER_MUSIC_LIMIT,
  type UserMusicTrack
} from "@/lib/user-music";

type AuthMode = "signIn" | "signUp" | "recover";

type UsageStats = {
  originalPhotos: number;
  editedPhotos: number;
  imageBundles: number;
  videos: number;
};

const initialStats: UsageStats = {
  originalPhotos: 0,
  editedPhotos: 0,
  imageBundles: 0,
  videos: 0
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};

const getAuthErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("auth/email-already-in-use")) {
    return "이미 가입된 이메일입니다.";
  }

  if (
    message.includes("auth/invalid-credential") ||
    message.includes("auth/wrong-password") ||
    message.includes("auth/user-not-found")
  ) {
    return "이메일 또는 비밀번호를 확인해 주세요.";
  }

  if (message.includes("auth/invalid-email")) {
    return "이메일 형식을 확인해 주세요.";
  }

  if (message.includes("auth/requires-recent-login")) {
    return "보안을 위해 다시 로그인한 뒤 비밀번호를 변경해 주세요.";
  }

  if (message.includes("auth/weak-password")) {
    return "비밀번호는 6자리 이상으로 입력해 주세요.";
  }

  if (message.includes("Firebase 연결 정보") || message.includes("Firebase Storage")) {
    return "Firebase 연결 정보가 아직 설정되지 않았습니다.";
  }

  if (message.includes("최대 3개")) {
    return "내 음악은 최대 3개까지 저장할 수 있습니다.";
  }

  if (message.includes("로그인 후 내 음악")) {
    return "로그인 후 내 음악을 관리할 수 있습니다.";
  }

  return "계정 처리 중 문제가 발생했습니다.";
};

export default function AccountScreen() {
  const {
    user,
    subscription,
    isLoggedIn,
    hasFullAccess,
    isAuthLoading,
    isFirebaseReady,
    signIn,
    signInWithGoogleIdToken,
    signUp,
    logOut,
    sendVerificationEmail,
    resetPassword,
    changePassword,
    updateName,
    refreshUser,
    startMockSubscription
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isMusicSubmitting, setIsMusicSubmitting] = useState(false);
  const [stats, setStats] = useState<UsageStats>(initialStats);
  const [musicTracks, setMusicTracks] = useState<UserMusicTrack[]>([]);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const isGoogleReady = Boolean(googleWebClientId && googleAndroidClientId);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadStats = async () => {
        const [photos, videos, imageBundles, userMusicTracks] = await Promise.all([
          getPhotos(),
          getMadeVideos(),
          getImageBundleWorks(),
          user ? syncUserMusicTracks(user) : Promise.resolve([])
        ]);

        if (!isActive) {
          return;
        }

        setStats({
          originalPhotos: photos.filter((photo) => photo.kind === "original").length,
          editedPhotos: photos.filter((photo) => photo.kind === "edited").length,
          imageBundles: imageBundles.length,
          videos: videos.length
        });
        setMusicTracks(userMusicTracks);
      };

      loadStats();

      return () => {
        isActive = false;
      };
    }, [user])
  );

  const providerText = useMemo(() => {
    if (!user) {
      return "없음";
    }

    const providers = user.providerData.map((provider) => provider.providerId);
    if (providers.includes("google.com")) {
      return "Google";
    }

    return "이메일";
  }, [user]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName]);

  const accountEmail = user?.email ?? email;

  const runAuthAction = async (action: () => Promise<void>, successMessage: string) => {
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrimaryAuth = () => {
    if (mode === "recover") {
      runAuthAction(
        () => resetPassword(email),
        "입력한 이메일로 비밀번호 재설정 메일을 보냈습니다."
      );
      return;
    }

    if (!email.trim() || password.length < 6) {
      setMessage("이메일과 6자리 이상 비밀번호를 입력해 주세요.");
      return;
    }

    if (mode === "signUp") {
      runAuthAction(async () => {
        await signUp(email, password);
        setPassword("");
      }, "회원가입을 완료했습니다. 이메일 인증 메일을 확인해 주세요.");
      return;
    }

    runAuthAction(async () => {
      await signIn(email, password);
      setPassword("");
    }, "로그인했습니다.");
  };

  const handleGoogleSignIn = () => {
    if (!isGoogleReady) {
      setMessage("Google 로그인 설정값을 확인해 주세요.");
      return;
    }

    const runGoogleLogin = async () => {
      setIsGoogleSubmitting(true);
      setMessage(null);

      const AuthSession = await import("expo-auth-session");
      const request = new AuthSession.AuthRequest({
        clientId: Platform.OS === "android" ? googleAndroidClientId! : googleWebClientId!,
        responseType: AuthSession.ResponseType.IdToken,
        redirectUri: "com.haebi.photoguide:/oauthredirect",
        scopes: ["openid", "profile", "email"],
        usePKCE: false,
        extraParams: {
          nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          prompt: "select_account"
        }
      });
      const result = await request.promptAsync({
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth"
      });

      if (result.type === "success") {
        const idToken = result.params.id_token;
        if (!idToken) {
          throw new Error("Google 로그인 토큰을 받지 못했습니다.");
        }

        await signInWithGoogleIdToken(idToken);
        setMessage("Google 계정으로 로그인했습니다.");
        return;
      }

      if (result.type === "cancel" || result.type === "dismiss") {
        setMessage("Google 로그인을 취소했습니다.");
        return;
      }

      throw new Error("Google 로그인 중 문제가 발생했습니다.");
    };

    runGoogleLogin().catch((error) => {
      setIsGoogleSubmitting(false);
      const message = error instanceof Error ? error.message : String(error);
      setMessage(
        message.includes("ExpoWebBrowser") ||
          message.includes("native module") ||
          message.includes("Cannot find native module")
          ? "Google 로그인 모듈이 현재 앱 빌드에 포함되지 않았습니다. Android 개발 빌드를 다시 만든 뒤 시도해 주세요."
          : getAuthErrorMessage(error)
      );
    }).finally(() => {
      setIsGoogleSubmitting(false);
    });
  };

  const handleChangePassword = () => {
    if (newPassword.length < 6) {
      setMessage("새 비밀번호는 6자리 이상으로 입력해 주세요.");
      return;
    }

    runAuthAction(async () => {
      await changePassword(newPassword);
      setNewPassword("");
    }, "비밀번호를 변경했습니다.");
  };

  const handleUpdateName = () => {
    runAuthAction(() => updateName(displayName), "이름을 저장했습니다.");
  };

  const handleMockPayment = () => {
    if (!user) {
      setMessage("로그인 후 구독 결제를 진행해 주세요.");
      return;
    }

    runAuthAction(async () => {
      await startMockSubscription();
    }, "테스트 결제가 완료되었습니다. Firestore에 결제 기록을 저장했습니다.");
  };

  const handleUploadMusic = async () => {
    if (isMusicSubmitting) {
      return;
    }

    try {
      setIsMusicSubmitting(true);
      setMessage(null);
      const nextTracks = await pickAndUploadUserMusicTrack(user);
      setMusicTracks(nextTracks);
      setMessage("내 음악을 저장했습니다. 영상 만들기에서 선택할 수 있습니다.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsMusicSubmitting(false);
    }
  };

  const handleDeleteMusic = async (track: UserMusicTrack) => {
    if (isMusicSubmitting) {
      return;
    }

    try {
      setIsMusicSubmitting(true);
      setMessage(null);
      const nextTracks = await deleteUserMusicTrack({ user, track });
      setMusicTracks(nextTracks);
      setMessage("내 음악을 삭제했습니다.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsMusicSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="계정"
      title={isLoggedIn ? "내 계정과 사용 기록" : "로그인하고 작업을 보관하세요."}
      description={
        isLoggedIn
          ? "이메일 인증, 구독 상태, 저장한 작업 기록을 한곳에서 확인합니다."
          : "이메일 인증 후 프리미엄을 활성화하면 워터마크 없이 저장하고 작업 백업을 사용할 수 있습니다."
      }
      safeTop
    >
      {!isFirebaseReady ? (
        <SectionBlock title="연결 필요">
          <View style={styles.noticePanel}>
            <Text selectable style={styles.noticeTitle}>
              Firebase 설정이 필요합니다.
            </Text>
            <Text selectable style={styles.noticeText}>
              .env에 Firebase 웹 앱 config를 넣고 Metro 서버를 다시 시작하면 로그인 기능이 활성화됩니다.
            </Text>
          </View>
        </SectionBlock>
      ) : null}

      {isFirebaseReady && !isLoggedIn ? (
        <SectionBlock title="로그인">
          <View style={styles.segment}>
            {[
              { label: "로그인", value: "signIn" },
              { label: "회원가입", value: "signUp" },
              { label: "찾기", value: "recover" }
            ].map((item) => {
              const isActive = mode === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                  onPress={() => {
                    setMode(item.value as AuthMode);
                    setMessage(null);
                  }}
                >
                  <Text
                    selectable={false}
                    style={[styles.segmentText, isActive && styles.segmentTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>
            <TextInput
              value={email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="이메일"
              placeholderTextColor={colors.faint}
              style={styles.input}
              onChangeText={setEmail}
            />
            {mode !== "recover" ? (
              <TextInput
                value={password}
                secureTextEntry
                placeholder="비밀번호 6자리 이상"
                placeholderTextColor={colors.faint}
                style={styles.input}
                onChangeText={setPassword}
              />
            ) : (
              <Text selectable style={styles.helpText}>
                트래블프레임의 아이디는 이메일입니다. 보안상 가입 여부는 직접 표시하지 않고,
                입력한 이메일로 비밀번호 재설정 메일을 보냅니다.
              </Text>
            )}
            <Pressable
              disabled={isSubmitting || isAuthLoading}
              style={[styles.primaryButton, (isSubmitting || isAuthLoading) && styles.disabledButton]}
              onPress={handlePrimaryAuth}
            >
              <Text selectable={false} style={styles.primaryButtonText}>
                {mode === "signIn"
                  ? "이메일로 로그인"
                  : mode === "signUp"
                    ? "인증 메일 받고 가입"
                    : "재설정 메일 보내기"}
              </Text>
            </Pressable>
            <Pressable
              disabled={isSubmitting || isAuthLoading || isGoogleSubmitting}
              style={[
                styles.secondaryButton,
                (isSubmitting || isAuthLoading || isGoogleSubmitting) && styles.disabledButton
              ]}
              onPress={handleGoogleSignIn}
            >
              <Text selectable={false} style={styles.secondaryButtonText}>
                {isGoogleSubmitting ? "Google 로그인 중" : "Google로 계속하기"}
              </Text>
            </Pressable>
          </View>
        </SectionBlock>
      ) : null}

      {isFirebaseReady && isLoggedIn ? (
        <>
          <SectionBlock title="내 정보">
            <View style={styles.profilePanel}>
              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  <Text selectable={false} style={styles.avatarText}>
                    {(user?.displayName ?? user?.email ?? "계정").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileCopy}>
                  <Text selectable style={styles.profileName}>
                    {user?.displayName || "이름 없음"}
                  </Text>
                  <Text selectable style={styles.profileEmail}>
                    {accountEmail}
                  </Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                <StatusBadge label={hasFullAccess ? "인증 완료" : "인증 대기"} active={hasFullAccess} />
                <StatusBadge label={providerText} active />
              </View>
              {!hasFullAccess ? (
                <View style={styles.verifyPanel}>
                  <Text selectable style={styles.helpText}>
                    이메일 인증과 프리미엄 활성화가 완료되어야 운영 환경에서 전체 기능과 워터마크 제거를 안정적으로 사용할 수 있습니다.
                  </Text>
                  <View style={styles.inlineActions}>
                    <Pressable
                      disabled={isSubmitting}
                      style={styles.secondaryButton}
                      onPress={() =>
                        runAuthAction(
                          sendVerificationEmail,
                          "인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요."
                        )
                      }
                    >
                      <Text selectable={false} style={styles.secondaryButtonText}>
                        인증 메일 재발송
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isSubmitting}
                      style={styles.secondaryButton}
                      onPress={() =>
                        runAuthAction(refreshUser, "인증 상태를 새로 확인했습니다.")
                      }
                    >
                      <Text selectable={false} style={styles.secondaryButtonText}>
                        상태 새로고침
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </SectionBlock>

          <SectionBlock title="계정 기록">
            <View style={styles.infoList}>
              <InfoRow label="가입일" value={formatDateTime(user?.metadata.creationTime)} />
              <InfoRow label="마지막 로그인" value={formatDateTime(user?.metadata.lastSignInTime)} />
              <InfoRow
                label="구독 상태"
                value={
                  subscription.status === "active"
                    ? subscription.productName
                    : "무료 플랜"
                }
              />
              <InfoRow
                label="구독 시작일"
                value={subscription.startedAt ? formatDateTime(subscription.startedAt) : "아직 구독 전"}
              />
              <InfoRow
                label="다음 갱신일"
                value={subscription.expiresAt ? formatDateTime(subscription.expiresAt) : "없음"}
              />
              <InfoRow label="클라우드 백업" value={hasFullAccess ? "사용 가능" : "프리미엄 활성 후 사용 권장"} />
            </View>
          </SectionBlock>

          <SectionBlock title="구독 결제">
            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <View style={styles.planCopy}>
                  <Text selectable style={styles.planTitle}>
                    트래블프레임 프리미엄
                  </Text>
                  <Text selectable style={styles.planPrice}>
                    월 4,900원
                  </Text>
                </View>
                <StatusBadge
                  label={subscription.status === "active" ? "이용 중" : "테스트"}
                  active={subscription.status === "active"}
                />
              </View>
              <View style={styles.benefitList}>
                <Text selectable style={styles.benefitText}>
                  이메일 인증 후 워터마크 없이 MP4 저장
                </Text>
                <Text selectable style={styles.benefitText}>
                  영상 만들기와 클라우드 백업 이용
                </Text>
                <Text selectable style={styles.benefitText}>
                  향후 실제 결제 승인 후 같은 구독 상태로 연결
                </Text>
              </View>
              <Text selectable style={styles.helpText}>
                현재는 실제 결제가 아닌 테스트 결제입니다. 버튼을 누르면 결제 완료처럼 처리하고 Firestore에 기록을 남깁니다.
              </Text>
              <Pressable
                disabled={isSubmitting}
                style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
                onPress={handleMockPayment}
              >
                <Text selectable={false} style={styles.primaryButtonText}>
                  {subscription.status === "active" ? "테스트 결제 다시 기록" : "테스트 결제하기"}
                </Text>
              </Pressable>
            </View>
          </SectionBlock>

          <SectionBlock title="사용 기록">
            <View style={styles.statsGrid}>
              <StatCard label="원본 사진" value={stats.originalPhotos} />
              <StatCard label="편집 사진" value={stats.editedPhotos} />
              <StatCard label="여러 사진 작업" value={stats.imageBundles} />
              <StatCard label="만든 영상" value={stats.videos} />
            </View>
          </SectionBlock>

          <SectionBlock title="내 음악 관리">
            <View style={styles.musicPanel}>
              <Text selectable style={styles.helpText}>
                핸드폰에 있는 음악을 최대 {USER_MUSIC_LIMIT}개까지 저장하고 영상 만들기에서 사용할 수 있습니다.
              </Text>
              <View style={styles.musicHeader}>
                <Text selectable style={styles.musicCount}>
                  {musicTracks.length} / {USER_MUSIC_LIMIT}
                </Text>
                <Pressable
                  disabled={isMusicSubmitting || musicTracks.length >= USER_MUSIC_LIMIT}
                  style={[
                    styles.secondaryButton,
                    styles.musicUploadButton,
                    (isMusicSubmitting || musicTracks.length >= USER_MUSIC_LIMIT) &&
                      styles.disabledButton
                  ]}
                  onPress={handleUploadMusic}
                >
                  <Text selectable={false} style={styles.secondaryButtonText}>
                    음악 추가
                  </Text>
                </Pressable>
              </View>
              <View style={styles.musicList}>
                {musicTracks.length > 0 ? (
                  musicTracks.map((track) => (
                    <View key={track.id} style={styles.musicItem}>
                      <View style={styles.musicCopy}>
                        <Text selectable style={styles.musicTitle}>
                          {track.name}
                        </Text>
                        <Text selectable style={styles.musicDetail}>
                          {formatDateTime(track.createdAt)}
                        </Text>
                      </View>
                      <Pressable
                        disabled={isMusicSubmitting}
                        style={[styles.musicDeleteButton, isMusicSubmitting && styles.disabledButton]}
                        onPress={() => handleDeleteMusic(track)}
                      >
                        <Text selectable={false} style={styles.musicDeleteText}>
                          삭제
                        </Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text selectable style={styles.helpText}>
                    아직 저장한 음악이 없습니다.
                  </Text>
                )}
              </View>
            </View>
          </SectionBlock>

          <SectionBlock title="계정 관리">
            <View style={styles.form}>
              <TextInput
                value={displayName}
                placeholder="표시 이름"
                placeholderTextColor={colors.faint}
                style={styles.input}
                onChangeText={setDisplayName}
              />
              <Pressable
                disabled={isSubmitting}
                style={[styles.secondaryButton, isSubmitting && styles.disabledButton]}
                onPress={handleUpdateName}
              >
                <Text selectable={false} style={styles.secondaryButtonText}>
                  이름 저장
                </Text>
              </Pressable>
              <TextInput
                value={newPassword}
                secureTextEntry
                placeholder="새 비밀번호 6자리 이상"
                placeholderTextColor={colors.faint}
                style={styles.input}
                onChangeText={setNewPassword}
              />
              <Pressable
                disabled={isSubmitting}
                style={[styles.secondaryButton, isSubmitting && styles.disabledButton]}
                onPress={handleChangePassword}
              >
                <Text selectable={false} style={styles.secondaryButtonText}>
                  비밀번호 변경
                </Text>
              </Pressable>
              <Pressable
                disabled={isSubmitting}
                style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
                onPress={() => runAuthAction(logOut, "로그아웃했습니다.")}
              >
                <Text selectable={false} style={styles.primaryButtonText}>
                  로그아웃
                </Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              >
                <Text selectable={false} style={styles.secondaryButtonText}>
                  개인정보처리방침
                </Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => Linking.openURL(DELETE_ACCOUNT_REQUEST_URL)}
              >
                <Text selectable={false} style={styles.secondaryButtonText}>
                  계정 및 데이터 삭제 요청
                </Text>
              </Pressable>
            </View>
          </SectionBlock>
        </>
      ) : null}

      {message ? (
        <View style={styles.messagePanel}>
          {isSubmitting ? <ActivityIndicator color={colors.text} /> : null}
          <Text selectable style={styles.messageText}>
            {message}
          </Text>
        </View>
      ) : null}
    </ScreenShell>
  );
}

function StatusBadge({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.statusBadge, active && styles.statusBadgeActive]}>
      <Text selectable={false} style={[styles.statusBadgeText, active && styles.statusBadgeTextActive]}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text selectable style={styles.infoLabel}>
        {label}
      </Text>
      <Text selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text selectable style={styles.statValue}>
        {value}
      </Text>
      <Text selectable style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noticePanel: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8
  },
  noticeTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  noticeText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
    letterSpacing: 0
  },
  segment: {
    flexDirection: "row",
    gap: 8
  },
  segmentButton: {
    minHeight: controls.compactHeight,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  segmentButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  segmentText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  segmentTextActive: {
    color: colors.inverse
  },
  form: {
    gap: 10
  },
  input: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.body,
    letterSpacing: 0
  },
  primaryButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  primaryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  secondaryButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.45
  },
  helpText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  profilePanel: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 14
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.text
  },
  avatarText: {
    color: colors.inverse,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0
  },
  profileCopy: {
    flex: 1,
    gap: 4
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0
  },
  profileEmail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statusBadge: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  statusBadgeActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  statusBadgeText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  statusBadgeTextActive: {
    color: colors.inverse
  },
  verifyPanel: {
    gap: 10
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8
  },
  infoList: {
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  infoRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  infoLabel: {
    color: colors.muted,
    fontSize: typography.small,
    letterSpacing: 0
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  },
  planCard: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.text,
    gap: 14,
    backgroundColor: colors.background
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  planCopy: {
    flex: 1,
    gap: 6
  },
  planTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
    letterSpacing: 0
  },
  planPrice: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    letterSpacing: 0
  },
  benefitList: {
    gap: 8
  },
  benefitText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statCard: {
    width: "48%",
    minHeight: 86,
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0
  },
  statLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  musicPanel: {
    gap: 12
  },
  musicHeader: {
    minHeight: controls.height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  musicCount: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    letterSpacing: 0
  },
  musicUploadButton: {
    minWidth: 112
  },
  musicList: {
    gap: 8
  },
  musicItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  musicCopy: {
    flex: 1,
    gap: 5
  },
  musicTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  musicDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  musicDeleteButton: {
    minWidth: 64,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  musicDeleteText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  messagePanel: {
    padding: spacing.row,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10
  },
  messageText: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  }
});
