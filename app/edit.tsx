import * as ImagePicker from "expo-image-picker";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EditablePhotoCanvas,
  type EditablePhotoCanvasHandle
} from "@/components/editable-photo-canvas";
import { colors, controls, typography } from "@/constants/app-theme";
import type { GuideType } from "@/constants/camera-guides";
import {
  clearEditDraft,
  getEditDraft,
  isSameEditDraftSource,
  saveEditDraft,
  type PhotoEditDraft
} from "@/lib/photo-edit-draft";
import { defaultAppSettings, getAppSettings } from "@/lib/app-settings";
import { getPhotoById, saveEditedPhoto } from "@/lib/photo-library";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { PhotoEditTransform, PhotoItem, PhotoRatioLabel } from "@/types/photo";

type EditableSource = {
  uri: string;
  width?: number;
  height?: number;
  sourcePhotoId?: string;
};

const ratios: PhotoRatioLabel[] = ["Original", "1:1", "3:4", "4:5", "9:16", "16:9"];

const ratioDisplayLabel = (value: PhotoRatioLabel) =>
  value === "Original" ? "원본" : value;

const getFallbackTransform = (ratio: PhotoRatioLabel): PhotoEditTransform => ({
  ratioLabel: ratio,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotation: 0
});

const formatDraftTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const getDraftSourceKey = (draft: Pick<PhotoEditDraft, "sourceUri" | "sourcePhotoId">) =>
  draft.sourcePhotoId ?? draft.sourceUri;

export default function EditScreen() {
  const { photoId } = useLocalSearchParams<{ photoId?: string }>();
  const canvasRef = useRef<EditablePhotoCanvasHandle>(null);
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<EditableSource | null>(null);
  const [sourcePhoto, setSourcePhoto] = useState<PhotoItem | null>(null);
  const [ratio, setRatio] = useState<PhotoRatioLabel>("Original");
  const [isLoading, setIsLoading] = useState(Boolean(photoId));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [availableDraft, setAvailableDraft] = useState<PhotoEditDraft | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [dismissedDraftSourceKey, setDismissedDraftSourceKey] = useState<string | null>(null);
  const [pendingTransform, setPendingTransform] = useState<PhotoEditTransform | null>(null);
  const [transformApplyKey, setTransformApplyKey] = useState(0);
  const [guide, setGuide] = useState<GuideType>(defaultAppSettings.defaultGuide);
  const [guideVisible, setGuideVisible] = useState(defaultAppSettings.guideVisible);
  const [guideSize, setGuideSize] = useState(defaultAppSettings.guideSize);
  const [guideColor, setGuideColor] = useState(defaultAppSettings.guideColor);
  const originalAspectRatio =
    source?.width && source?.height ? source.width / source.height : undefined;

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      if (!photoId) {
        setIsLoading(false);
        return;
      }

      const photo = await getPhotoById(photoId);
      if (isMounted && photo) {
        setSourcePhoto(photo);
        setSource({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          sourcePhotoId: photo.id
        });
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadPhoto();

    return () => {
      isMounted = false;
    };
  }, [photoId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadGuideSettings = async () => {
        const settings = await getAppSettings();
        if (!isActive) {
          return;
        }

        setGuide(settings.defaultGuide);
        setGuideVisible(settings.guideVisible);
        setGuideSize(settings.guideSize);
        setGuideColor(settings.guideColor);
      };

      loadGuideSettings();

      return () => {
        isActive = false;
      };
    }, [])
  );

  useEffect(() => {
    let isMounted = true;

    const loadDraft = async () => {
      const draft = await getEditDraft();
      if (!isMounted) {
        return;
      }

      if (!draft) {
        setAvailableDraft(null);
        setShowDraftPrompt(false);
        return;
      }

      if (!source || isSameEditDraftSource(draft, source)) {
        setAvailableDraft(draft);
        setShowDraftPrompt(getDraftSourceKey(draft) !== dismissedDraftSourceKey);
      } else {
        setAvailableDraft(null);
        setShowDraftPrompt(false);
      }
    };

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, [dismissedDraftSourceKey, source]);

  const persistDraft = useCallback(async (updateState = true) => {
    if (!source || isSaving) {
      return;
    }

    const draft = await saveEditDraft({
      sourceUri: source.uri,
      sourcePhotoId: source.sourcePhotoId,
      width: source.width,
      height: source.height,
      transform: canvasRef.current?.getTransform() ?? getFallbackTransform(ratio)
    });

    if (updateState) {
      setAvailableDraft(draft);
    }
  }, [isSaving, ratio, source]);

  useEffect(() => {
    if (!source) {
      return;
    }

    const interval = setInterval(() => {
      void persistDraft();
    }, 2500);

    return () => {
      clearInterval(interval);
      void persistDraft(false);
    };
  }, [persistDraft, source]);

  const pickPhoto = async () => {
    setMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);

    if (!permission.granted) {
      setMessage("사진을 불러오려면 앨범 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      setSourcePhoto(null);
      setSource({
        uri: asset.uri,
        width: asset.width,
        height: asset.height
      });
      setRatio("Original");
      setPendingTransform(null);
      setAvailableDraft(null);
      setShowDraftPrompt(false);
      setDismissedDraftSourceKey(null);
      setMessage(null);
    }
  };

  const resumeDraft = async () => {
    if (!availableDraft) {
      return;
    }

    try {
      setMessage(null);
      if (availableDraft.sourcePhotoId) {
        const draftPhoto = await getPhotoById(availableDraft.sourcePhotoId);
        setSourcePhoto(draftPhoto);
      } else {
        setSourcePhoto(null);
      }

      setSource({
        uri: availableDraft.sourceUri,
        width: availableDraft.width,
        height: availableDraft.height,
        sourcePhotoId: availableDraft.sourcePhotoId
      });
      setRatio(availableDraft.transform.ratioLabel);
      setPendingTransform(availableDraft.transform);
      setTransformApplyKey((current) => current + 1);
      setDismissedDraftSourceKey(getDraftSourceKey(availableDraft));
      setShowDraftPrompt(false);
      setMessage("임시 저장된 편집 상태를 불러왔습니다.");
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "임시 저장을 불러오지 못했습니다."));
    }
  };

  const removeDraft = async () => {
    try {
      await clearEditDraft();
      setAvailableDraft(null);
      setShowDraftPrompt(false);
      setDismissedDraftSourceKey(null);
      setPendingTransform(null);
      setMessage("임시 저장을 삭제했습니다.");
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "임시 저장을 삭제하지 못했습니다."));
    }
  };

  const saveEdit = async () => {
    if (!source || isSaving) {
      setMessage("저장하기 전에 사진을 먼저 불러와 주세요.");
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      const savedPhoto = await saveEditedPhoto({
        sourceUri: source.uri,
        sourcePhotoId: source.sourcePhotoId,
        width: source.width,
        height: source.height,
        transform: canvasRef.current?.getTransform() ?? getFallbackTransform(ratio)
      });

      await clearEditDraft();
      router.replace(`/photo/${savedPhoto.id}` as Href);
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "편집 결과를 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.ghostButton} onPress={() => router.back()}>
          <Text selectable={false} style={styles.ghostButtonText}>
            취소
          </Text>
        </Pressable>
        <Text selectable={false} style={styles.title}>
          사진 편집
        </Text>
        <Pressable
          disabled={isSaving || !source}
          style={[styles.saveButton, (!source || isSaving) && styles.disabledButton]}
          onPress={saveEdit}
        >
          <Text selectable={false} style={styles.saveButtonText}>
            {isSaving ? "저장 중" : "저장"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.canvasWrap}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.inverse} />
          </View>
        ) : (
          <EditablePhotoCanvas
            ref={canvasRef}
            uri={source?.uri ?? null}
            ratio={ratio}
            originalAspectRatio={originalAspectRatio}
            initialTransform={pendingTransform}
            initialTransformKey={transformApplyKey}
            guide={guide}
            guideVisible={guideVisible}
            guideSize={guideSize}
            guideColor={guideColor}
          />
        )}
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 14 }]}>
        {availableDraft && showDraftPrompt ? (
          <View style={styles.draftPanel}>
            <View style={styles.draftCopy}>
              <Text selectable style={styles.draftTitle}>
                임시 저장된 편집이 있습니다
              </Text>
              <Text selectable style={styles.draftDetail}>
                {formatDraftTime(availableDraft.updatedAt)} 작업 상태에서 이어갈 수 있습니다.
              </Text>
            </View>
            <View style={styles.draftActions}>
              <Pressable style={styles.draftButton} onPress={resumeDraft}>
                <Text selectable={false} style={styles.draftButtonText}>
                  이어 작업하기
                </Text>
              </Pressable>
              <Pressable style={styles.draftGhostButton} onPress={removeDraft}>
                <Text selectable={false} style={styles.draftGhostButtonText}>
                  삭제
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sourceRow}>
          <View style={styles.sourceCopy}>
            <Text selectable style={styles.sourceTitle}>
              {sourcePhoto ? "저장된 사진을 불러왔습니다" : source ? "앨범 사진을 불러왔습니다" : "선택된 사진이 없습니다"}
            </Text>
            <Text selectable style={styles.sourceDetail}>
              {source
                ? `${source.width ?? 0} x ${source.height ?? 0} / ${ratio}`
                : "촬영한 사진이나 앨범 사진을 불러와 시작하세요."}
            </Text>
          </View>
          <Pressable style={styles.loadButton} onPress={pickPhoto}>
            <Text selectable={false} style={styles.loadButtonText}>
              사진 불러오기
            </Text>
          </Pressable>
        </View>

        <View style={styles.ratioRow}>
          {ratios.map((item) => {
            const isActive = ratio === item;

            return (
              <Pressable
                key={item}
                style={[styles.ratioChip, isActive && styles.ratioChipActive]}
                onPress={() => setRatio(item)}
              >
                <Text
                  selectable={false}
                  style={[styles.ratioText, isActive && styles.ratioTextActive]}
                >
                  {ratioDisplayLabel(item)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.toolRow}>
          <Pressable style={[styles.toolButton, styles.toolButtonActive]}>
            <Text selectable={false} style={styles.toolButtonText}>
              이동
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolButton}
            onPress={() => canvasRef.current?.rotateRight()}
          >
            <Text selectable={false} style={styles.toolButtonText}>
              회전
            </Text>
          </Pressable>
          <Pressable style={styles.toolButton} onPress={() => canvasRef.current?.reset()}>
            <Text selectable={false} style={styles.toolButtonText}>
              초기화
            </Text>
          </Pressable>
        </View>

        {message ? (
          <Text selectable style={styles.message}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink
  },
  topBar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: colors.ink
  },
  title: {
    color: colors.inverse,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  ghostButton: {
    minWidth: 68,
    minHeight: controls.compactHeight,
    justifyContent: "center"
  },
  ghostButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  saveButton: {
    minWidth: 68,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inverse
  },
  saveButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.45
  },
  canvasWrap: {
    flex: 1,
    minHeight: 240
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomPanel: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: colors.background
  },
  draftPanel: {
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.surface
  },
  draftCopy: {
    gap: 4
  },
  draftTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  draftDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  draftActions: {
    flexDirection: "row",
    gap: 8
  },
  draftButton: {
    flex: 1,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  draftButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  draftGhostButton: {
    minWidth: 72,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  draftGhostButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sourceCopy: {
    flex: 1,
    gap: 4
  },
  sourceTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  sourceDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  loadButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text
  },
  loadButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  ratioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  ratioChip: {
    minHeight: controls.compactHeight,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  ratioChipActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  ratioText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  ratioTextActive: {
    color: colors.inverse
  },
  toolRow: {
    flexDirection: "row",
    gap: 8
  },
  toolButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  toolButtonActive: {
    borderColor: colors.text
  },
  toolButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  message: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  }
});
