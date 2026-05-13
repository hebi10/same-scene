import { Image } from "expo-image";
import { useAudioPlayer, type AudioSource } from "expo-audio";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

import { TripClipPreviewPlayer } from "@/components/trip-clip-preview-player";
import { colors, controls, spacing, typography } from "@/constants/app-theme";
import {
  GUIDE_LABELS,
  GUIDE_TYPES,
  type GuideType
} from "@/constants/camera-guides";
import {
  MUSIC_TRACKS,
  TRIP_CLIP_RATIOS,
  TRIP_CLIP_TRANSITIONS,
  type MusicTrack,
  type TripClipRatio,
  type TripClipTemplate,
  type TripClipTransition
} from "@/constants/trip-clip";
import {
  downloadRenderedVideo,
  requestTripClipRender,
  saveImageToLibrary,
  saveVideoToLibrary,
  shareImage,
  shareVideo
} from "@/lib/trip-clip-export";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  getAppSettings,
  updateAppSettings
} from "@/lib/app-settings";
import { ensurePhotoPreviews, getPhotos, saveCapturedPhoto } from "@/lib/photo-library";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { getMadeVideoById, saveMadeVideo } from "@/lib/video-library";
import type { PhotoItem } from "@/types/photo";

const DEFAULT_DURATION = 2.5;
const initialExportProgress = {
  visible: false,
  percent: 0,
  title: "",
  detail: ""
};
const FADE_OPTIONS = [
  { label: "짧게", value: 0.25 },
  { label: "기본", value: 0.45 },
  { label: "길게", value: 0.75 }
] as const;

type MusicMode = "none" | "device" | "recommended";
type RecommendedMusicId = Exclude<MusicTrack["id"], "none">;
type ExportFormat = "mp4" | "cover";
type ExportProgress = {
  visible: boolean;
  percent: number;
  title: string;
  detail: string;
  completedVideoId?: string;
  error?: string;
};
type CustomMusic = {
  uri: string;
  name: string;
  mimeType?: string;
};
type EditorTab = "photos" | "timeline" | "video" | "guide" | "music" | "export";

const MUSIC_MODE_OPTIONS: { label: string; value: MusicMode }[] = [
  { label: "무음", value: "none" },
  { label: "내 음악", value: "device" },
  { label: "추천 음악", value: "recommended" }
];

const EXPORT_FORMAT_OPTIONS: {
  label: string;
  value: ExportFormat;
  detail: string;
}[] = [
  {
    label: "MP4 영상",
    value: "mp4",
    detail: "사진, 전환 효과, 음악을 영상으로 저장합니다."
  },
  {
    label: "대표 이미지",
    value: "cover",
    detail: "현재 미리보기 사진을 이미지로 저장합니다."
  }
];

const RECOMMENDED_MUSIC_TRACKS = MUSIC_TRACKS.filter(
  (track): track is MusicTrack & { id: RecommendedMusicId; source: number } =>
    track.id !== "none" && typeof track.source === "number"
);

const GUIDE_SIZE_OPTIONS = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;
const GUIDE_COLOR_OPTIONS = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

const EDITOR_TABS: { label: string; value: EditorTab }[] = [
  { label: "사진", value: "photos" },
  { label: "타임라인", value: "timeline" },
  { label: "영상", value: "video" },
  { label: "가이드", value: "guide" },
  { label: "음악", value: "music" },
  { label: "내보내기", value: "export" }
];

const getDefaultRenderServerUrl = () => {
  if (process.env.EXPO_PUBLIC_RENDER_SERVER_URL) {
    return process.env.EXPO_PUBLIC_RENDER_SERVER_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:4321` : "http://localhost:4321";
};

const defaultRenderServerUrl = getDefaultRenderServerUrl();

const ratioAspect: Record<TripClipRatio, number> = {
  "9:16": 9 / 16,
  "4:5": 4 / 5,
  "1:1": 1,
  "16:9": 16 / 9,
  "3:4": 3 / 4
};

const getPhotoLabel = (photo: PhotoItem) =>
  photo.kind === "edited" ? "편집 사진" : "원본 사진";

const getPreviewUri = (photo: PhotoItem) => photo.previewUri ?? photo.uri;

const formatClipTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

export default function TripClipScreen() {
  const { videoId } = useLocalSearchParams<{ videoId?: string }>();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [ratio, setRatio] = useState<TripClipRatio>("9:16");
  const [template, setTemplate] = useState<TripClipTemplate>("minimal");
  const [transition, setTransition] = useState<TripClipTransition>("fade");
  const [transitionDuration, setTransitionDuration] = useState(0.45);
  const [musicMode, setMusicMode] = useState<MusicMode>("none");
  const [selectedMusicId, setSelectedMusicId] = useState<RecommendedMusicId>("calm");
  const [customMusic, setCustomMusic] = useState<CustomMusic | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [previewAdjustEnabled, setPreviewAdjustEnabled] = useState(false);
  const [previewGuideVisible, setPreviewGuideVisible] = useState(false);
  const [previewGuide, setPreviewGuide] = useState<GuideType>("circle");
  const [previewGuideSize, setPreviewGuideSize] = useState(44);
  const [previewGuideSizeInput, setPreviewGuideSizeInput] = useState("44");
  const [previewGuideColor, setPreviewGuideColor] = useState<string>(
    GUIDE_COLOR_OPTIONS[0].value
  );
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>("photos");
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMusicPreviewing, setIsMusicPreviewing] = useState(false);
  const [renderServerUrl] = useState(defaultRenderServerUrl);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");
  const [isExporting, setIsExporting] = useState(false);
  const [renderedVideoUri, setRenderedVideoUri] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportProgress, setExportProgress] =
    useState<ExportProgress>(initialExportProgress);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressSeconds, setProgressSeconds] = useState(0);
  const restoredVideoIdRef = useRef<string | null>(null);
  const playbackOffsetRef = useRef(0);
  const playbackProgress = useSharedValue(0);

  const selectedMusic =
    RECOMMENDED_MUSIC_TRACKS.find((track) => track.id === selectedMusicId) ??
    RECOMMENDED_MUSIC_TRACKS[0];
  const activeMusicSource = useMemo<AudioSource | undefined>(() => {
    if (musicMode === "device") {
      return customMusic ? { uri: customMusic.uri, name: customMusic.name } : undefined;
    }

    if (musicMode === "recommended") {
      return selectedMusic.source;
    }

    return undefined;
  }, [customMusic, musicMode, selectedMusic.source]);
  const activeMusicLabel =
    musicMode === "device"
      ? customMusic?.name ?? "내 음악 선택"
      : musicMode === "recommended"
        ? selectedMusic.label
        : "무음";
  const player = useAudioPlayer(activeMusicSource);

  const selectedPhotos = useMemo(
    () =>
      selectedIds
        .map((id) => photos.find((photo) => photo.id === id))
        .filter((photo): photo is PhotoItem => Boolean(photo)),
    [photos, selectedIds]
  );

  const activePhoto = selectedPhotos[activeIndex] ?? selectedPhotos[0];
  const totalDuration = selectedIds.reduce(
    (sum, id) => sum + (durations[id] ?? DEFAULT_DURATION),
    0
  );

  const getStartTimeForIndex = useCallback(
    (index: number) =>
      selectedIds
        .slice(0, Math.max(0, index))
        .reduce((sum, id) => sum + (durations[id] ?? DEFAULT_DURATION), 0),
    [durations, selectedIds]
  );

  const getPlaybackPosition = useCallback(
    (seconds: number) => {
      const safeSeconds = Math.max(0, Math.min(totalDuration, seconds));
      let elapsed = 0;

      for (let index = 0; index < selectedIds.length; index += 1) {
        const id = selectedIds[index];
        const duration = durations[id] ?? DEFAULT_DURATION;
        const isLast = index === selectedIds.length - 1;

        if (safeSeconds < elapsed + duration || isLast) {
          return {
            index,
            offset: Math.max(0, Math.min(duration, safeSeconds - elapsed)),
            seconds: safeSeconds
          };
        }

        elapsed += duration;
      }

      return {
        index: 0,
        offset: 0,
        seconds: 0
      };
    },
    [durations, selectedIds, totalDuration]
  );

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    const [storedPhotos, settings] = await Promise.all([
      getPhotos().then(ensurePhotoPreviews),
      getAppSettings()
    ]);
    setPhotos(storedPhotos);
    setPreviewGuide(settings.defaultGuide);
    setPreviewGuideVisible(settings.guideVisible);
    setPreviewGuideSize(settings.guideSize);
    setPreviewGuideSizeInput(String(settings.guideSize));
    setPreviewGuideColor(settings.guideColor);

    if (videoId && restoredVideoIdRef.current !== videoId) {
      const storedVideo = await getMadeVideoById(videoId);
      if (storedVideo) {
        const availableIds = storedVideo.photoIds.filter((id) =>
          storedPhotos.some((photo) => photo.id === id)
        );
        setSelectedIds(availableIds);
        setDurations(storedVideo.durations);
        setRatio(storedVideo.ratio);
        setTemplate(storedVideo.template);
        setTransition(storedVideo.transition);
        setTransitionDuration(storedVideo.transitionDuration);
        restoredVideoIdRef.current = videoId;
        setIsLoading(false);
        return;
      }
    }

    setRatio(settings.defaultRatio);
    setSelectedIds((current) => {
      if (current.length > 0) {
        return current.filter((id) => storedPhotos.some((photo) => photo.id === id));
      }

      return storedPhotos
        .filter((photo) => photo.addedToVideo)
        .map((photo) => photo.id);
    });
    setIsLoading(false);
  }, [videoId]);

  const applyPreviewGuideSize = useCallback((value: number) => {
    const nextSize = Math.round(
      Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, value))
    );
    setPreviewGuideSize(nextSize);
    setPreviewGuideSizeInput(String(nextSize));
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideSize: nextSize,
      guideVisible: true
    });
  }, []);

  const updatePreviewGuideType = (nextGuide: GuideType) => {
    setPreviewGuide(nextGuide);
    setPreviewGuideVisible(true);
    void updateAppSettings({
      defaultGuide: nextGuide,
      guideVisible: true
    });
  };

  const updatePreviewGuideVisibility = (nextVisible: boolean) => {
    setPreviewGuideVisible(nextVisible);
    void updateAppSettings({ guideVisible: nextVisible });
  };

  const updatePreviewGuideColor = (nextColor: string) => {
    setPreviewGuideColor(nextColor);
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideColor: nextColor,
      guideVisible: true
    });
  };

  const commitPreviewGuideSizeInput = () => {
    const parsedSize = Number(previewGuideSizeInput);
    if (!Number.isFinite(parsedSize)) {
      setPreviewGuideSizeInput(String(previewGuideSize));
      return;
    }

    applyPreviewGuideSize(parsedSize);
  };

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos])
  );

  useEffect(() => {
    player.volume = activeMusicSource ? volume : 0;
    player.loop = true;

    if (!activeMusicSource) {
      player.pause();
      setIsMusicPreviewing(false);
    }
  }, [activeMusicSource, player, volume]);

  useEffect(() => {
    if (activeIndex >= selectedPhotos.length) {
      setActiveIndex(Math.max(0, selectedPhotos.length - 1));
    }

    if (selectedPhotos.length === 0) {
      setProgressSeconds(0);
      setActiveEditorTab("photos");
    }
  }, [activeIndex, selectedPhotos.length]);

  useEffect(() => {
    if (!isPlaying || selectedPhotos.length === 0) {
      return;
    }

    const currentId = selectedPhotos[activeIndex]?.id;
    const duration = currentId ? durations[currentId] ?? DEFAULT_DURATION : DEFAULT_DURATION;
    const playbackOffset = Math.max(
      0,
      Math.min(duration - 0.05, playbackOffsetRef.current)
    );
    playbackOffsetRef.current = 0;
    const remainingDuration = Math.max(0.05, duration - playbackOffset);
    const durationMs = remainingDuration * 1000;
    const startSeconds = getStartTimeForIndex(activeIndex) + playbackOffset;

    setProgressSeconds(startSeconds);
    cancelAnimation(playbackProgress);
    playbackProgress.value = startSeconds;
    playbackProgress.value = withTiming(
      Math.min(totalDuration, startSeconds + remainingDuration),
      {
        duration: durationMs,
        easing: Easing.linear
      }
    );

    const timer = setTimeout(() => {
      const nextProgress = Math.min(totalDuration, startSeconds + remainingDuration);
      setProgressSeconds(nextProgress);
      setActiveIndex((index) => {
        if (index >= selectedPhotos.length - 1) {
          setIsPlaying(false);
          player.pause();
          setIsMusicPreviewing(false);
          setProgressSeconds(totalDuration);
          return index;
        }

        return index + 1;
      });
    }, durationMs);

    return () => {
      cancelAnimation(playbackProgress);
      clearTimeout(timer);
    };
  }, [
    activeIndex,
    durations,
    getStartTimeForIndex,
    isPlaying,
    player,
    playbackProgress,
    selectedPhotos,
    totalDuration
  ]);

  const togglePhoto = (photo: PhotoItem) => {
    setSelectedIds((current) => {
      if (current.includes(photo.id)) {
        return current.filter((id) => id !== photo.id);
      }

      setDurations((values) => ({
        ...values,
        [photo.id]: values[photo.id] ?? DEFAULT_DURATION
      }));
      return [...current, photo.id];
    });
  };

  const pickPhotosFromPreview = async () => {
    if (isImportingPhotos) {
      return;
    }

    try {
      setIsImportingPhotos(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);

      if (!permission.granted) {
        setExportMessage("사진을 선택하려면 앨범 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: 10,
        quality: 1
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const savedPhotos = await Promise.all(
        result.assets.map((asset) =>
          saveCapturedPhoto({
            uri: asset.uri,
            width: asset.width,
            height: asset.height
          })
        )
      );

      setPhotos((current) => [...savedPhotos, ...current]);
      setSelectedIds((current) => [
        ...current,
        ...savedPhotos
          .map((photo) => photo.id)
          .filter((id) => !current.includes(id))
      ]);
      setDurations((current) => ({
        ...current,
        ...savedPhotos.reduce<Record<string, number>>(
          (next, photo) => ({
            ...next,
            [photo.id]: current[photo.id] ?? DEFAULT_DURATION
          }),
          {}
        )
      }));
      setActiveIndex(0);
      setExportMessage(null);
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "사진을 선택하지 못했습니다."));
    } finally {
      setIsImportingPhotos(false);
    }
  };

  const movePhoto = (id: string, direction: -1 | 1) => {
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const changeDuration = (id: string, delta: number) => {
    setDurations((current) => ({
      ...current,
      [id]: Math.max(0.5, Math.min(8, Number(((current[id] ?? DEFAULT_DURATION) + delta).toFixed(1))))
    }));
  };

  const changeVolume = (delta: number) => {
    setVolume((value) => Math.max(0, Math.min(1, Number((value + delta).toFixed(1)))));
  };

  const pickDeviceMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      setCustomMusic({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType
      });
      setMusicMode("device");
      setIsMusicPreviewing(false);
      player.pause();
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "음악 파일을 선택하지 못했습니다."));
    }
  };

  const seekPreview = useCallback(
    (seconds: number) => {
      if (selectedPhotos.length === 0 || totalDuration <= 0) {
        setProgressSeconds(0);
        return;
      }

      const position = getPlaybackPosition(seconds);

      setIsPlaying(false);
      setIsMusicPreviewing(false);
      player.pause();
      cancelAnimation(playbackProgress);
      playbackProgress.value = position.seconds;
      playbackOffsetRef.current = position.offset;
      setActiveIndex(position.index);
      setProgressSeconds(position.seconds);
    },
    [getPlaybackPosition, playbackProgress, player, selectedPhotos.length, totalDuration]
  );

  const stopPlayback = () => {
    const currentProgress = Math.max(0, Math.min(totalDuration, playbackProgress.value));
    const position = getPlaybackPosition(currentProgress);
    cancelAnimation(playbackProgress);
    playbackOffsetRef.current = position.offset;
    setProgressSeconds(position.seconds);
    setActiveIndex(position.index);
    setIsPlaying(false);
    setIsMusicPreviewing(false);
    player.pause();
  };

  const resetPlayback = () => {
    cancelAnimation(playbackProgress);
    playbackProgress.value = 0;
    playbackOffsetRef.current = 0;
    setIsPlaying(false);
    setIsMusicPreviewing(false);
    setActiveIndex(0);
    setProgressSeconds(0);
    player.pause();
  };

  const jumpPhoto = (direction: -1 | 1) => {
    if (selectedPhotos.length === 0) {
      return;
    }

    const nextIndex = Math.max(
      0,
      Math.min(selectedPhotos.length - 1, activeIndex + direction)
    );
    const nextSeconds = getStartTimeForIndex(nextIndex);

    cancelAnimation(playbackProgress);
    playbackProgress.value = nextSeconds;
    playbackOffsetRef.current = 0;
    setIsPlaying(false);
    setIsMusicPreviewing(false);
    setActiveIndex(nextIndex);
    setProgressSeconds(nextSeconds);
    player.pause();
  };

  const preloadSelectedPreviewImages = async () => {
    const uris = selectedPhotos.map(getPreviewUri);
    if (uris.length === 0) {
      return;
    }

    try {
      await Image.prefetch(uris, "memory-disk");
    } catch {
      // Preloading is a best-effort optimization. Playback should still work.
    }
  };

  const playClip = async () => {
    if (selectedPhotos.length === 0) {
      return;
    }

    await preloadSelectedPreviewImages();

    const startSeconds = progressSeconds >= totalDuration ? 0 : progressSeconds;
    const position = getPlaybackPosition(startSeconds);

    playbackOffsetRef.current = position.offset;
    playbackProgress.value = position.seconds;
    setActiveIndex(position.index);
    setProgressSeconds(position.seconds);
    setIsPlaying(true);

    if (activeMusicSource) {
      player.volume = volume;
      await player.seekTo(position.seconds);
      player.play();
      setIsMusicPreviewing(true);
    }
  };

  const toggleMusicPreview = async () => {
    if (!activeMusicSource) {
      stopPlayback();
      return;
    }

    if (isMusicPreviewing) {
      player.pause();
      setIsMusicPreviewing(false);
      return;
    }

    player.volume = volume;
    await player.seekTo(0);
    player.play();
    setIsMusicPreviewing(true);
  };

  const renderMp4Video = async (onProgress?: (percent: number, detail: string) => void) => {
    if (renderedVideoUri) {
      return renderedVideoUri;
    }

    if (selectedPhotos.length === 0 || isExporting) {
      setExportMessage("내보내기 전에 사진을 선택해 주세요.");
      return null;
    }

    if (!renderServerUrl.trim()) {
      setExportMessage("영상 저장 준비가 완료되지 않았습니다.");
      return null;
    }

    setExportMessage("사진과 음악을 영상으로 만드는 중입니다.");
    onProgress?.(25, "사진과 음악을 렌더 서버로 보내고 있습니다.");
    setRenderedVideoUri(null);

    const renderResult = await requestTripClipRender(renderServerUrl.trim(), {
      ratio,
      template,
      transition,
      transitionDuration,
      musicId:
        musicMode === "device"
          ? "custom"
          : musicMode === "recommended"
            ? selectedMusicId
            : "none",
      customMusic: musicMode === "device" ? customMusic ?? undefined : undefined,
      volume,
      frames: selectedPhotos.map((photo) => ({
        photo,
        duration: durations[photo.id] ?? DEFAULT_DURATION
      }))
    });

    onProgress?.(75, "완성된 영상을 핸드폰으로 가져오고 있습니다.");
    const localUri = await downloadRenderedVideo(
      renderResult.videoUrl,
      renderResult.fileName
    );
    setRenderedVideoUri(localUri);
    return localUri;
  };

  const saveSelectedExport = async () => {
    if (selectedPhotos.length === 0 || isExporting) {
      setExportMessage("저장하기 전에 사진을 선택해 주세요.");
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress({
        visible: true,
        percent: 5,
        title: "저장 준비 중",
        detail: "선택한 저장 형식을 확인하고 있습니다."
      });

      if (exportFormat === "cover") {
        if (!activePhoto) {
          setExportMessage("저장할 대표 이미지가 없습니다.");
          return;
        }

        setExportProgress({
          visible: true,
          percent: 55,
          title: "대표 이미지 저장 중",
          detail: "현재 미리보기 사진을 앨범에 저장하고 있습니다."
        });
        await saveImageToLibrary(activePhoto.uri);
        setExportMessage("대표 이미지가 핸드폰에 저장되었습니다.");
        setExportProgress({
          visible: true,
          percent: 100,
          title: "저장 완료",
          detail: "대표 이미지가 핸드폰 앨범에 저장되었습니다."
        });
        return;
      }

      const videoUri = await renderMp4Video((percent, detail) => {
        setExportProgress({
          visible: true,
          percent,
          title: "영상 저장 중",
          detail
        });
      });
      if (!videoUri) {
        return;
      }

      setExportProgress({
        visible: true,
        percent: 88,
        title: "핸드폰에 저장 중",
        detail: "완성된 MP4 영상을 앨범에 저장하고 있습니다."
      });
      await saveVideoToLibrary(videoUri);
      const savedVideo = await saveMadeVideo({
        uri: videoUri,
        coverUri: activePhoto?.uri,
        ratio,
        template,
        transition,
        transitionDuration,
        duration: totalDuration,
        photoIds: selectedPhotos.map((photo) => photo.id),
        durations: selectedPhotos.reduce<Record<string, number>>((next, photo) => {
          next[photo.id] = durations[photo.id] ?? DEFAULT_DURATION;
          return next;
        }, {}),
        musicId:
          musicMode === "device"
            ? "custom"
            : musicMode === "recommended"
              ? selectedMusicId
              : "none",
        musicLabel: activeMusicLabel
      });
      setExportMessage("MP4 영상이 핸드폰에 저장되었습니다.");
      setExportProgress({
        visible: true,
        percent: 100,
        title: "저장 완료",
        detail: "만든 영상 화면으로 이동할 수 있습니다.",
        completedVideoId: savedVideo.id
      });
      setTimeout(() => {
        router.replace(`/video/${savedVideo.id}` as Href);
      }, 650);
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "저장하지 못했습니다.");
      setExportMessage(message);
      setExportProgress({
        visible: true,
        percent: 100,
        title: "저장 실패",
        detail: "저장 중 문제가 발생했습니다.",
        error: message
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareSelectedExport = async () => {
    if (selectedPhotos.length === 0 || isExporting) {
      setExportMessage("공유하기 전에 사진을 선택해 주세요.");
      return;
    }

    try {
      setIsExporting(true);

      if (exportFormat === "cover") {
        if (!activePhoto) {
          setExportMessage("공유할 대표 이미지가 없습니다.");
          return;
        }

        await shareImage(activePhoto.uri);
        return;
      }

      const videoUri = await renderMp4Video();
      if (!videoUri) {
        return;
      }

      await shareVideo(videoUri);
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "공유하지 못했습니다."));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.screenRoot}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
        contentContainerStyle={styles.content}
      >
      <View style={styles.header}>
        <Text selectable style={styles.eyebrow}>
          여행 클립
        </Text>
        <Text selectable style={styles.title}>
          사진으로 영상 미리보기를 만드세요.
        </Text>
        <Text selectable style={styles.description}>
          사진을 고르고 순서를 정한 뒤 템플릿과 음악을 적용해 앱 안에서 영상처럼 재생합니다.
        </Text>
      </View>

      <View style={styles.previewSection}>
        <View style={[styles.previewFrame, { aspectRatio: ratioAspect[ratio] }]}>
          {activePhoto ? (
            <TripClipPreviewPlayer
              photo={activePhoto}
              template={template}
              transition={transition}
              transitionDuration={transitionDuration}
              adjustEnabled={previewAdjustEnabled}
              guideVisible={previewGuideVisible}
              guide={previewGuide}
              guideSize={previewGuideSize}
              guideColor={previewGuideColor}
            />
          ) : (
            <Pressable
              disabled={isImportingPhotos}
              style={({ pressed }) => [
                styles.emptyPreview,
                pressed && styles.emptyPreviewPressed,
                isImportingPhotos && styles.disabledButton
              ]}
              onPress={pickPhotosFromPreview}
            >
              <Text selectable style={styles.emptyPreviewText}>
                {isImportingPhotos ? "사진을 불러오는 중" : "사진을 선택하세요"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.previewMeta}>
          <Text selectable style={styles.previewTitle}>
            사진 {selectedPhotos.length}장 / {totalDuration.toFixed(1)}초
          </Text>
          <Text selectable style={styles.previewDetail}>
            {ratio} / {transitionLabel(transition)} / {activeMusicLabel}
          </Text>
        </View>

        <View style={styles.playbackPanel}>
          <View style={styles.playbackTopRow}>
            <View style={styles.playbackSide}>
              <Pressable
                disabled={selectedPhotos.length === 0}
                style={[
                  styles.playToggleButton,
                  selectedPhotos.length === 0 && styles.disabledButton
                ]}
                onPress={isPlaying ? stopPlayback : playClip}
              >
                <Text selectable={false} style={styles.playToggleText}>
                  {isPlaying ? "멈춤" : "재생"}
                </Text>
              </Pressable>
              <Pressable style={styles.restartButton} onPress={() => jumpPhoto(-1)}>
                <Text selectable={false} style={styles.restartButtonText}>
                  이전
                </Text>
              </Pressable>
            </View>
            <Text selectable style={styles.timeText}>
              {formatClipTime(progressSeconds)} / {formatClipTime(totalDuration)}
            </Text>
            <View style={[styles.playbackSide, styles.playbackSideRight]}>
              <Pressable style={styles.restartButton} onPress={() => jumpPhoto(1)}>
                <Text selectable={false} style={styles.restartButtonText}>
                  다음
                </Text>
              </Pressable>
              <Pressable style={styles.restartButton} onPress={resetPlayback}>
                <Text selectable={false} style={styles.restartButtonText}>
                  처음
                </Text>
              </Pressable>
            </View>
          </View>
          <TimelineScrubber
            progressSeconds={progressSeconds}
            progressValue={playbackProgress}
            totalDuration={totalDuration}
            onSeek={seekPreview}
          />
        </View>
      </View>

      {activeEditorTab === "photos" ? (
      <Section title="사진 선택">
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoPicker}
          >
            {photos.map((photo) => {
              const selectedIndex = selectedIds.indexOf(photo.id);
              const isSelected = selectedIndex >= 0;

              return (
                <Pressable
                  key={photo.id}
                  style={[styles.photoTile, isSelected && styles.photoTileActive]}
                  onPress={() => togglePhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
                  <View style={styles.photoTileMeta}>
                    <Text selectable style={styles.photoTileText}>
                      {getPhotoLabel(photo)}
                    </Text>
                    <Text selectable style={styles.photoTileDetail}>
                      {photo.ratioLabel}
                    </Text>
                  </View>
                  {isSelected ? (
                    <>
                      <View style={styles.orderBadge}>
                        <Text selectable={false} style={styles.orderBadgeText}>
                          {selectedIndex + 1}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.removePhotoButton}
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          togglePhoto(photo);
                        }}
                      >
                        <Text selectable={false} style={styles.removePhotoButtonText}>
                          X
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              disabled={isImportingPhotos}
              style={[
                styles.photoTile,
                styles.addPhotoTile,
                isImportingPhotos && styles.disabledButton
              ]}
              onPress={pickPhotosFromPreview}
            >
              <View style={styles.addPhotoIcon}>
                <Text selectable={false} style={styles.addPhotoIconText}>
                  +
                </Text>
              </View>
              <Text selectable={false} style={styles.addPhotoTitle}>
                사진 추가
              </Text>
              <Text selectable={false} style={styles.addPhotoDetail}>
                앨범에서 선택
              </Text>
            </Pressable>
          </ScrollView>
        ) : (
          <Text selectable style={styles.emptyText}>
            아직 사진이 없습니다. 먼저 사진을 촬영하거나 편집해 주세요.
          </Text>
        )}
      </Section>
      ) : null}

      {activeEditorTab === "timeline" ? (
      <Section title="타임라인">
        {selectedPhotos.length > 0 ? (
          <View style={styles.timeline}>
            {selectedPhotos.map((photo, index) => (
              <View key={photo.id} style={styles.timelineRow}>
                <Image source={{ uri: photo.uri }} style={styles.timelineThumb} contentFit="cover" />
                <View style={styles.timelineCopy}>
                  <Text selectable style={styles.timelineTitle}>
                    {String(index + 1).padStart(2, "0")} / {getPhotoLabel(photo)}
                  </Text>
                  <Text selectable style={styles.timelineDetail}>
                    {(durations[photo.id] ?? DEFAULT_DURATION).toFixed(1)}s
                  </Text>
                </View>
                <View style={styles.smallControls}>
                  <View style={styles.controlLine}>
                    <Text selectable={false} style={styles.controlLabel}>
                      순서
                    </Text>
                    <SmallButton label="위" onPress={() => movePhoto(photo.id, -1)} />
                    <SmallButton label="아래" onPress={() => movePhoto(photo.id, 1)} />
                  </View>
                  <View style={styles.controlLine}>
                    <Text selectable={false} style={styles.controlLabel}>
                      타임
                    </Text>
                    <SmallButton label="-" onPress={() => changeDuration(photo.id, -0.5)} />
                    <SmallButton label="+" onPress={() => changeDuration(photo.id, 0.5)} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text selectable style={styles.emptyText}>
            타임라인을 만들려면 사진을 1장 이상 선택해 주세요.
          </Text>
        )}
      </Section>
      ) : null}

      {activeEditorTab === "video" ? (
      <Section title="영상 설정">
        <OptionRow>
          {TRIP_CLIP_RATIOS.map((item) => (
            <Chip
              key={item}
              label={item}
              active={ratio === item}
              onPress={() => setRatio(item)}
            />
          ))}
        </OptionRow>
        <OptionRow>
          {TRIP_CLIP_TRANSITIONS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={transition === item.id}
              onPress={() => setTransition(item.id)}
            />
          ))}
        </OptionRow>
        {transition === "fade" ? (
          <>
            <Text selectable style={styles.settingDetail}>
              페이드 속도 {transitionDuration.toFixed(2)}초
            </Text>
            <OptionRow>
              {FADE_OPTIONS.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  active={transitionDuration === item.value}
                  onPress={() => setTransitionDuration(item.value)}
                />
              ))}
            </OptionRow>
          </>
        ) : null}
      </Section>
      ) : null}

      {activeEditorTab === "guide" ? (
      <Section title="가이드 설정">
        <View style={styles.guideSummaryPanel}>
          <View style={styles.guideSummaryCopy}>
            <Text selectable style={styles.settingDetail}>
              미리보기 사진 위에 카메라와 같은 구도 가이드를 표시합니다.
            </Text>
            <Text selectable style={styles.guideSummaryValue}>
              {previewGuideVisible ? "표시 중" : "숨김"} / {GUIDE_LABELS[previewGuide]} /{" "}
              {previewGuideSize}
            </Text>
          </View>
          <Pressable
            style={[
              styles.guideToggleButton,
              previewGuideVisible && styles.guideToggleButtonActive
            ]}
            onPress={() => updatePreviewGuideVisibility(!previewGuideVisible)}
          >
            <Text
              selectable={false}
              style={[
                styles.guideToggleButtonText,
                previewGuideVisible && styles.guideToggleButtonTextActive
              ]}
            >
              가이드 {previewGuideVisible ? "끄기" : "켜기"}
            </Text>
          </Pressable>
        </View>

        <Text selectable style={styles.settingLabel}>
          드래그 조절
        </Text>
        <OptionRow>
          <Chip
            label={previewAdjustEnabled ? "켜짐" : "꺼짐"}
            active={previewAdjustEnabled}
            onPress={() => setPreviewAdjustEnabled((value) => !value)}
          />
        </OptionRow>
        <Text selectable style={styles.settingDetail}>
          켜면 미리보기 사진을 손가락으로 이동하고 확대할 수 있습니다.
        </Text>

        <Text selectable style={styles.settingLabel}>
          가이드라인
        </Text>
        <OptionRow>
          {GUIDE_TYPES.map((type) => (
            <Chip
              key={type}
              label={GUIDE_LABELS[type]}
              active={previewGuide === type}
              onPress={() => updatePreviewGuideType(type)}
            />
          ))}
        </OptionRow>

        <Text selectable style={styles.settingLabel}>
          크기
        </Text>
        <OptionRow>
          {GUIDE_SIZE_OPTIONS.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={previewGuideSize === item.value}
              onPress={() => applyPreviewGuideSize(item.value)}
            />
          ))}
        </OptionRow>
        <View style={styles.guideSizeInputRow}>
          <Text selectable style={styles.settingDetail}>
            {GUIDE_SIZE_MIN}-{GUIDE_SIZE_MAX}
          </Text>
          <TextInput
            value={previewGuideSizeInput}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            style={styles.guideSizeInput}
            onChangeText={(value) =>
              setPreviewGuideSizeInput(value.replace(/[^0-9]/g, ""))
            }
            onBlur={commitPreviewGuideSizeInput}
            onSubmitEditing={commitPreviewGuideSizeInput}
          />
        </View>

        <Text selectable style={styles.settingLabel}>
          색상
        </Text>
        <View style={styles.guideColorRow}>
          {GUIDE_COLOR_OPTIONS.map((option) => {
            const isActive = previewGuideColor === option.value;

            return (
              <Pressable
                key={option.label}
                style={[styles.guideColorOption, isActive && styles.guideColorOptionActive]}
                onPress={() => updatePreviewGuideColor(option.value)}
              >
                <View
                  style={[
                    styles.guideColorSwatch,
                    { backgroundColor: option.value }
                  ]}
                />
                <Text selectable={false} style={styles.guideColorLabel}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
      ) : null}

      {activeEditorTab === "music" ? (
      <Section title="음악">
        <OptionRow>
          {MUSIC_MODE_OPTIONS.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={musicMode === item.value}
              onPress={() => {
                stopPlayback();
                setMusicMode(item.value);
              }}
            />
          ))}
        </OptionRow>

        {musicMode === "device" ? (
          <View style={styles.musicList}>
            <View style={styles.musicRow}>
              <View style={styles.musicCopy}>
                <Text selectable style={styles.musicTitle}>
                  {customMusic?.name ?? "선택된 음악이 없습니다"}
                </Text>
                <Text selectable style={styles.musicDetail}>
                  휴대폰에 저장된 오디오 파일을 선택합니다.
                </Text>
              </View>
              <Pressable style={styles.musicPickButton} onPress={pickDeviceMusic}>
                <Text selectable={false} style={styles.musicPickButtonText}>
                  선택
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {musicMode === "recommended" ? (
          <View style={styles.musicList}>
            <OptionRow>
              {RECOMMENDED_MUSIC_TRACKS.map((track) => (
                <Chip
                  key={track.id}
                  label={track.label}
                  active={selectedMusicId === track.id}
                  onPress={() => {
                    stopPlayback();
                    setSelectedMusicId(track.id);
                  }}
                />
              ))}
            </OptionRow>
            <Text selectable style={styles.settingDetail}>
              {selectedMusic.detail}
            </Text>
          </View>
        ) : null}

        {musicMode !== "none" ? (
          <View style={styles.previewActions}>
            <Pressable
              disabled={!activeMusicSource}
              style={[styles.secondaryButton, !activeMusicSource && styles.disabledButton]}
              onPress={toggleMusicPreview}
            >
              <Text selectable={false} style={styles.secondaryButtonText}>
                {isMusicPreviewing ? "음악 정지" : "음악 재생"}
              </Text>
            </Pressable>
            <View style={styles.volumeControls}>
              <SmallButton label="-" onPress={() => changeVolume(-0.1)} />
              <Text selectable style={styles.volumeText}>
                {Math.round(volume * 100)}%
              </Text>
              <SmallButton label="+" onPress={() => changeVolume(0.1)} />
            </View>
          </View>
        ) : null}
      </Section>
      ) : null}

      {activeEditorTab === "export" ? (
      <Section title="핸드폰에 저장">
        <View style={styles.exportPanel}>
          <Text selectable style={styles.exportDetail}>
            저장할 형식을 선택한 뒤 바로 핸드폰 앨범에 저장하거나 공유합니다.
          </Text>
          <View style={styles.exportFormatList}>
            {EXPORT_FORMAT_OPTIONS.map((option) => {
              const isActive = exportFormat === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.exportFormatOption, isActive && styles.exportFormatOptionActive]}
                  onPress={() => {
                    setExportFormat(option.value);
                    setExportMessage(null);
                  }}
                >
                  <View style={styles.exportFormatCopy}>
                    <Text
                      selectable
                      style={[
                        styles.exportFormatTitle,
                        isActive && styles.exportFormatTitleActive
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      selectable
                      style={[
                        styles.exportFormatDetail,
                        isActive && styles.exportFormatDetailActive
                      ]}
                    >
                      {option.detail}
                    </Text>
                  </View>
                  <View style={[styles.exportFormatMark, isActive && styles.exportFormatMarkActive]} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.previewActions}>
            <Pressable
              disabled={isExporting || selectedPhotos.length === 0}
              style={[
                styles.primaryButton,
                (isExporting || selectedPhotos.length === 0) && styles.disabledButton
              ]}
              onPress={saveSelectedExport}
            >
              <Text selectable={false} style={styles.primaryButtonText}>
                {isExporting ? "저장 중" : "핸드폰에 저장"}
              </Text>
            </Pressable>
            <Pressable
              disabled={isExporting || selectedPhotos.length === 0}
              style={[
                styles.secondaryButton,
                (isExporting || selectedPhotos.length === 0) && styles.disabledButton
              ]}
              onPress={shareSelectedExport}
            >
              <Text selectable={false} style={styles.secondaryButtonText}>
                공유
              </Text>
            </Pressable>
          </View>
          {exportMessage ? (
            <Text selectable style={styles.exportMessage}>
              {exportMessage}
            </Text>
          ) : null}
        </View>
      </Section>
      ) : null}
      </ScrollView>
      <View style={styles.bottomEditorTabs}>
        {EDITOR_TABS.map((tab) => {
          const isLocked = tab.value !== "photos" && selectedPhotos.length === 0;
          const isActive = activeEditorTab === tab.value;

          return (
            <Pressable
              key={tab.value}
              disabled={isLocked}
              style={[
                styles.bottomEditorTab,
                isActive && styles.bottomEditorTabActive,
                isLocked && styles.bottomEditorTabDisabled
              ]}
              onPress={() => setActiveEditorTab(tab.value)}
            >
              <Text
                selectable={false}
                style={[
                  styles.bottomEditorTabText,
                  isActive && styles.bottomEditorTabTextActive
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Modal
        visible={exportProgress.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isExporting) {
            setExportProgress(initialExportProgress);
          }
        }}
      >
        <View style={styles.exportModalBackdrop}>
          <View style={styles.exportModalPanel}>
            <Text selectable style={styles.exportModalEyebrow}>
              EXPORT
            </Text>
            <Text selectable style={styles.exportModalTitle}>
              {exportProgress.title}
            </Text>
            <Text selectable style={styles.exportModalDetail}>
              {exportProgress.error ?? exportProgress.detail}
            </Text>
            <View style={styles.exportProgressTrack}>
              <View
                style={[
                  styles.exportProgressFill,
                  { width: `${Math.max(0, Math.min(100, exportProgress.percent))}%` }
                ]}
              />
            </View>
            <Text selectable style={styles.exportProgressText}>
              {Math.round(exportProgress.percent)}%
            </Text>
            {!isExporting ? (
              <View style={styles.exportModalActions}>
                {exportProgress.completedVideoId ? (
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() =>
                      router.replace(`/video/${exportProgress.completedVideoId}` as Href)
                    }
                  >
                    <Text selectable={false} style={styles.primaryButtonText}>
                      만든 영상 보기
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setExportProgress(initialExportProgress)}
                >
                  <Text selectable={false} style={styles.secondaryButtonText}>
                    닫기
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text selectable style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function OptionRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.optionRow}>{children}</View>;
}

function Chip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text selectable={false} style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TimelineScrubber({
  progressSeconds,
  progressValue,
  totalDuration,
  onSeek
}: {
  progressSeconds: number;
  progressValue: SharedValue<number>;
  totalDuration: number;
  onSeek: (seconds: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progressRatio =
    totalDuration > 0 ? Math.max(0, Math.min(1, progressSeconds / totalDuration)) : 0;
  const progress = useSharedValue(progressRatio);

  useEffect(() => {
    progress.value = progressRatio;
    progressValue.value = progressSeconds;
  }, [progress, progressRatio, progressSeconds, progressValue]);

  const commitSeek = useCallback(
    (ratio: number) => {
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration]
  );

  const scrubberGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(trackWidth > 0 && totalDuration > 0)
        .minDistance(0)
        .onBegin((event) => {
          const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
          progress.value = ratio;
          progressValue.value = ratio * totalDuration;
        })
        .onUpdate((event) => {
          const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
          progress.value = ratio;
          progressValue.value = ratio * totalDuration;
        })
        .onFinalize(() => {
          runOnJS(commitSeek)(progress.value);
        }),
    [commitSeek, progress, progressValue, totalDuration, trackWidth]
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: `${(totalDuration > 0 ? progressValue.value / totalDuration : progress.value) * 100}%`
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${(totalDuration > 0 ? progressValue.value / totalDuration : progress.value) * 100}%`
  }));

  return (
    <GestureDetector gesture={scrubberGesture}>
      <Reanimated.View
        style={styles.scrubber}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.scrubberBase} />
        <Reanimated.View style={[styles.scrubberFill, fillStyle]} />
        <Reanimated.View style={[styles.scrubberThumb, thumbStyle]} />
      </Reanimated.View>
    </GestureDetector>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.smallButton} onPress={onPress}>
      <Text selectable={false} style={styles.smallButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

const transitionLabel = (id: TripClipTransition) =>
  TRIP_CLIP_TRANSITIONS.find((item) => item.id === id)?.label ?? id;

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    gap: spacing.section,
    padding: spacing.screen,
    paddingBottom: spacing.section
  },
  header: {
    gap: 10,
    paddingTop: 6
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 35,
    letterSpacing: 0
  },
  description: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    letterSpacing: 0
  },
  previewSection: {
    gap: 12
  },
  previewFrame: {
    width: "100%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.ink
  },
  previewInner: {
    flex: 1,
    backgroundColor: colors.ink,
    position: "relative"
  },
  previewInnerFilm: {
    padding: 22
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  previewGestureLayer: {
    flex: 1
  },
  previewPreviousLayer: {
    ...StyleSheet.absoluteFillObject
  },
  previewImageMotionLayer: {
    flex: 1
  },
  previewImageFilm: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  emptyPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyPreviewPressed: {
    backgroundColor: "#161616"
  },
  emptyPreviewText: {
    color: colors.inverse,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  previewMeta: {
    gap: 4
  },
  previewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  previewDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  previewActions: {
    flexDirection: "row",
    gap: 10
  },
  playbackPanel: {
    gap: 10,
    paddingTop: 2
  },
  playbackTopRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  playbackSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  playbackSideRight: {
    justifyContent: "flex-end"
  },
  playToggleButton: {
    minWidth: 56,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  playToggleText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  timeText: {
    width: 92,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  restartButton: {
    minWidth: 48,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  restartButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  scrubber: {
    height: 32,
    justifyContent: "center"
  },
  scrubberBase: {
    height: 2,
    backgroundColor: colors.line
  },
  scrubberFill: {
    position: "absolute",
    left: 0,
    height: 2,
    backgroundColor: colors.text
  },
  scrubberThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  primaryButton: {
    flex: 1,
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
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
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
  section: {
    gap: 12
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  loading: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center"
  },
  photoPicker: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 8
  },
  photoTile: {
    width: 124,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  photoTileActive: {
    borderColor: colors.text
  },
  addPhotoTile: {
    minHeight: 176,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: colors.background
  },
  addPhotoIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  addPhotoIconText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: 0
  },
  addPhotoTitle: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  addPhotoDetail: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  photoThumb: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surface
  },
  photoTileMeta: {
    gap: 3,
    minHeight: 54,
    padding: 8
  },
  photoTileText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  photoTileDetail: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  orderBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  orderBadgeText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  removePhotoButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  removePhotoButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 14,
    letterSpacing: 0
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  timeline: {
    gap: 10
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  timelineThumb: {
    width: 48,
    height: 60,
    backgroundColor: colors.surface
  },
  timelineCopy: {
    flex: 1,
    gap: 4
  },
  timelineTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  timelineDetail: {
    color: colors.muted,
    fontSize: typography.small,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  smallControls: {
    gap: 6,
    width: 134
  },
  controlLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  controlLabel: {
    minWidth: 28,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  smallButton: {
    minWidth: 34,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  settingDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  settingLabel: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideSummaryPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  guideSummaryCopy: {
    flex: 1,
    gap: 5
  },
  guideSummaryValue: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideToggleButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  guideToggleButtonActive: {
    backgroundColor: colors.text
  },
  guideToggleButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideToggleButtonTextActive: {
    color: colors.inverse
  },
  guideSizeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  guideSizeInput: {
    width: 64,
    minHeight: controls.height,
    borderWidth: 1,
    borderColor: colors.text,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0
  },
  guideColorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  guideColorOption: {
    minWidth: 58,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guideColorOptionActive: {
    borderColor: colors.text
  },
  guideColorSwatch: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.darkLine
  },
  guideColorLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  chip: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  chipActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  chipText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  chipTextActive: {
    color: colors.inverse
  },
  musicList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  musicRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  musicRowActive: {
    backgroundColor: colors.surface
  },
  musicCopy: {
    flex: 1,
    gap: 4,
    paddingLeft: 8
  },
  musicTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  musicDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  musicMark: {
    minWidth: 36,
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "right"
  },
  musicPickButton: {
    minWidth: 58,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  musicPickButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  volumeControls: {
    flex: 1,
    minHeight: controls.height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8
  },
  volumeText: {
    minWidth: 42,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  filmMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  filmText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  centerGuide: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    pointerEvents: "none"
  },
  exportPanel: {
    gap: 10,
    paddingTop: 2
  },
  exportDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  exportFormatList: {
    gap: 8
  },
  exportFormatOption: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  exportFormatOptionActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  exportFormatCopy: {
    flex: 1,
    gap: 4
  },
  exportFormatTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  exportFormatTitleActive: {
    color: colors.inverse
  },
  exportFormatDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportFormatDetailActive: {
    color: "rgba(255, 255, 255, 0.74)"
  },
  exportFormatMark: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: 999
  },
  exportFormatMarkActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  serverInputRow: {
    flexDirection: "row",
    gap: 8
  },
  serverPreset: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  serverPresetActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  serverPresetText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  serverPresetTextActive: {
    color: colors.inverse
  },
  serverUrlText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 17,
    letterSpacing: 0
  },
  serverInput: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.small,
    letterSpacing: 0
  },
  exportMessage: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  bottomEditorTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.background
  },
  bottomEditorTab: {
    width: "31.8%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  bottomEditorTabActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  bottomEditorTabDisabled: {
    opacity: 0.34
  },
  bottomEditorTabText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  bottomEditorTabTextActive: {
    color: colors.inverse
  }
});
