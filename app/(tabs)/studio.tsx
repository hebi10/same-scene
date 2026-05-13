import { Image } from "expo-image";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronIcon } from "@/components/chevron-icon";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { colors, controls, typography } from "@/constants/app-theme";
import { getPhotos } from "@/lib/photo-library";
import { getMadeVideos } from "@/lib/video-library";
import type { PhotoItem } from "@/types/photo";
import type { MadeVideoItem } from "@/types/video";

type StudioTab = "photos" | "edit" | "videos";

const tabs: { label: string; value: StudioTab }[] = [
  { label: "촬영 사진", value: "photos" },
  { label: "편집하기", value: "edit" },
  { label: "만든 영상", value: "videos" }
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

export default function StudioScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StudioTab>("photos");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<MadeVideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStudio = useCallback(async () => {
    setIsLoading(true);
    const [storedPhotos, storedVideos] = await Promise.all([
      getPhotos(),
      getMadeVideos()
    ]);
    setPhotos(storedPhotos);
    setVideos(storedVideos);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStudio();
    }, [loadStudio])
  );

  const capturedPhotos = photos.filter((photo) => photo.kind === "original");
  const editedPhotos = photos.filter((photo) => photo.edited);
  const clipPhotos = photos.filter((photo) => photo.addedToVideo);

  return (
    <ScreenShell
      eyebrow="편집"
      title="사진과 영상을 관리하세요."
      description="촬영 사진을 편집하고, 여행 클립을 만들고, 저장한 영상을 다시 확인합니다."
      safeTop
    >
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;

          return (
            <Pressable
              key={tab.value}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.value)}
            >
              <Text
                selectable={false}
                style={[styles.tabText, isActive && styles.tabTextActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "photos" ? (
        <SectionBlock title="촬영 사진">
          {isLoading ? (
            <LoadingState />
          ) : capturedPhotos.length > 0 ? (
            <View style={styles.photoGrid}>
              {capturedPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} router={router} />
              ))}
            </View>
          ) : (
            <EmptyState
              title="아직 촬영 사진이 없습니다."
              detail="카메라에서 구도 가이드로 촬영하면 이곳에 사진이 표시됩니다."
            />
          )}
        </SectionBlock>
      ) : null}

      {activeTab === "edit" ? (
        <>
          <SectionBlock title="영상 만들기">
            <Pressable
              style={({ pressed }) => [styles.clipCta, pressed && styles.pressed]}
              onPress={() => router.push("/trip-clip")}
            >
              <View style={styles.clipCopy}>
                <Text selectable style={styles.clipTitle}>
                  여행 클립 만들기
                </Text>
                <Text selectable style={styles.clipDetail}>
                  선택된 사진 {clipPhotos.length}장으로 템플릿과 음악을 적용합니다.
                </Text>
              </View>
              <View style={styles.clipAction}>
                <Text selectable={false} style={styles.clipActionText}>
                  시작
                </Text>
              </View>
            </Pressable>
          </SectionBlock>

          <SectionBlock title="편집한 사진">
            {isLoading ? (
              <LoadingState />
            ) : editedPhotos.length > 0 ? (
              <View style={styles.photoGrid}>
                {editedPhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} router={router} />
                ))}
              </View>
            ) : (
              <EmptyState
                title="아직 편집한 사진이 없습니다."
                detail="촬영 사진을 선택해 구도와 비율을 먼저 정리해 주세요."
              />
            )}
          </SectionBlock>
        </>
      ) : null}

      {activeTab === "videos" ? (
        <SectionBlock title="만든 영상">
          {isLoading ? (
            <LoadingState />
          ) : videos.length > 0 ? (
            <View style={styles.videoList}>
              {videos.map((video) => (
                <Pressable
                  key={video.id}
                  style={({ pressed }) => [styles.videoCard, pressed && styles.pressed]}
                  onPress={() => router.push(`/video/${video.id}` as Href)}
                >
                  {video.coverUri ? (
                    <Image
                      source={{ uri: video.coverUri }}
                      style={styles.videoThumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.videoThumbEmpty} />
                  )}
                  <View style={styles.videoCopy}>
                    <Text selectable style={styles.videoTitle}>
                      {video.title}
                    </Text>
                    <Text selectable style={styles.metaText}>
                      {formatDate(video.createdAt)} / {video.ratio} / {formatDuration(video.duration)}
                    </Text>
                    <Text selectable style={styles.metaText}>
                      사진 {video.photoIds.length}장 / {video.musicLabel}
                    </Text>
                  </View>
                  <View style={styles.chevron}>
                    <ChevronIcon color={colors.text} size={10} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              title="아직 만든 영상이 없습니다."
              detail="여행 클립을 MP4로 저장하면 이곳에서 다시 볼 수 있습니다."
            />
          )}
        </SectionBlock>
      ) : null}
    </ScreenShell>
  );
}

function PhotoCard({ photo, router }: { photo: PhotoItem; router: ReturnType<typeof useRouter> }) {
  return (
    <View style={styles.photoCard}>
      <Pressable onPress={() => router.push(`/photo/${photo.id}` as Href)}>
        <Image source={{ uri: photo.uri }} style={styles.thumbnail} contentFit="cover" />
      </Pressable>
      <View style={styles.photoMeta}>
        <Text selectable style={styles.photoDate}>
          {formatDate(photo.createdAt)}
        </Text>
        <Text selectable style={styles.metaText}>
          {photo.ratioLabel} / {photo.edited ? "편집됨" : "원본"}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={styles.cardButton}
          onPress={() => router.push(`/edit?photoId=${photo.id}` as Href)}
        >
          <Text selectable={false} style={styles.cardButtonText}>
            편집
          </Text>
        </Pressable>
        <Pressable
          style={styles.cardLightButton}
          onPress={() => router.push(`/photo/${photo.id}` as Href)}
        >
          <Text selectable={false} style={styles.cardLightButtonText}>
            보기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.text} />
    </View>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.emptyState}>
      <Text selectable style={styles.emptyTitle}>
        {title}
      </Text>
      <Text selectable style={styles.emptyDetail}>
        {detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tab: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  tabActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  tabText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  tabTextActive: {
    color: colors.inverse
  },
  clipCta: {
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  pressed: {
    backgroundColor: colors.surfaceStrong
  },
  clipCopy: {
    gap: 8
  },
  clipTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  clipDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  clipAction: {
    minHeight: 40,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  clipActionText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    lineHeight: 16,
    letterSpacing: 0
  },
  loading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 4
  },
  photoCard: {
    width: "47.8%",
    gap: 10
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  photoMeta: {
    gap: 4
  },
  photoDate: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  metaText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  cardActions: {
    flexDirection: "row",
    gap: 6
  },
  cardButton: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  cardButtonText: {
    color: colors.inverse,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  cardLightButton: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  cardLightButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  videoList: {
    gap: 10
  },
  videoCard: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  videoThumb: {
    width: 72,
    height: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  videoThumbEmpty: {
    width: 72,
    height: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink
  },
  videoCopy: {
    flex: 1,
    gap: 5
  },
  videoTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  chevron: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyState: {
    minHeight: 72,
    gap: 6,
    paddingTop: 2,
    paddingBottom: 10
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  emptyDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  }
});
