import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import type {
  TripClipRenderRequest,
  TripClipRenderResponse
} from "@/types/trip-clip";
import { getAppSettings, getUploadCompression } from "@/lib/app-settings";

type EncodedFrame = {
  id: string;
  fileName: string;
  mimeType: string;
  base64: string;
  duration: number;
  ratioLabel: string;
  createdAt: string;
};

type EncodedMusic = {
  fileName: string;
  mimeType?: string;
  base64: string;
};

type MediaLibraryModule = typeof import("expo-media-library");
type MediaPermissionKind = "photo" | "video";
export type ImageSaveFormat = "original" | "png" | "jpeg";
let androidDownloadDirectoryUri: string | null = null;

const getMediaLibrary = async (): Promise<MediaLibraryModule> =>
  import("expo-media-library");

const getMimeType = (uri: string) => {
  const cleanUri = uri.split("?")[0]?.toLowerCase() ?? uri.toLowerCase();

  if (cleanUri.endsWith(".png")) {
    return "image/png";
  }

  if (cleanUri.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
};

const getFileName = (uri: string, fallback: string) => {
  const cleanUri = uri.split("?")[0] ?? uri;
  const name = cleanUri.split("/").pop();
  return name && name.includes(".") ? name : `${fallback}.jpg`;
};

const getAudioFileName = (name: string | undefined, uri: string) => {
  const cleanName = name?.trim();
  if (cleanName && cleanName.includes(".")) {
    return cleanName;
  }

  const uriName = uri.split("?")[0]?.split("/").pop();
  if (uriName && uriName.includes(".")) {
    return uriName;
  }

  return "custom-music.mp3";
};

const prepareFrameForUpload = async (
  uri: string,
  width?: number,
  height?: number,
  compression = 0.86
) => {
  const maxEdge = Math.max(width ?? 0, height ?? 0);
  if (!maxEdge || maxEdge <= 1600) {
    return uri;
  }

  const scale = 1600 / maxEdge;
  const resized = await manipulateAsync(
    uri,
    [
      {
        resize: {
          width: width ? Math.round(width * scale) : undefined,
          height: height ? Math.round(height * scale) : undefined
        }
      }
    ],
    {
      compress: compression,
      format: SaveFormat.JPEG
    }
  );

  return resized.uri;
};

const getOutputUri = (fileName: string) => {
  if (!FileSystem.documentDirectory) {
    throw new Error("이 기기에서는 파일 저장소를 사용할 수 없습니다.");
  }

  return `${FileSystem.documentDirectory}${fileName}`;
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("렌더 서버 응답이 없습니다. 렌더 서버가 켜져 있는지 확인해 주세요.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getRenderEndpoint = (serverUrl: string, path: string) =>
  `${serverUrl.replace(/\/$/, "")}${path}`;

const assertRenderServerReady = async (serverUrl: string) => {
  let response: Response;

  try {
    response = await fetchWithTimeout(getRenderEndpoint(serverUrl, "/health"), {}, 4000);
  } catch {
    throw new Error(
      "PC에서 렌더 서버를 먼저 켜 주세요. 터미널에서 npm run render-server를 실행하면 됩니다."
    );
  }

  if (!response.ok) {
    const message = await response.text();
    if (message.includes("FFmpeg")) {
      throw new Error(
        "PC에 FFmpeg가 설치되어 있지 않습니다. FFmpeg 설치 후 렌더 서버를 다시 켜 주세요."
      );
    }

    throw new Error(
      message ||
        "렌더 서버 상태를 확인하지 못했습니다. 서버를 다시 실행한 뒤 저장해 주세요."
    );
  }
};

export const createTripClipRenderPayload = async ({
  frames,
  ratio,
  template,
  transition,
  transitionDuration,
  musicId,
  volume,
  customMusic
}: TripClipRenderRequest) => {
  const encodedFrames: EncodedFrame[] = [];
  const settings = await getAppSettings();
  const compression = getUploadCompression(settings.exportQuality);
  let encodedMusic: EncodedMusic | undefined;

  for (const frame of frames) {
    const uploadUri = await prepareFrameForUpload(
      frame.photo.uri,
      frame.photo.width,
      frame.photo.height,
      compression
    );
    const base64 = await FileSystem.readAsStringAsync(uploadUri, {
      encoding: FileSystem.EncodingType.Base64
    });

    encodedFrames.push({
      id: frame.photo.id,
      fileName: getFileName(uploadUri, frame.photo.id),
      mimeType: getMimeType(uploadUri),
      base64,
      duration: frame.duration,
      ratioLabel: frame.photo.ratioLabel,
      createdAt: frame.photo.createdAt
    });
  }

  if (musicId === "custom" && customMusic?.uri) {
    const base64 = await FileSystem.readAsStringAsync(customMusic.uri, {
      encoding: FileSystem.EncodingType.Base64
    });

    encodedMusic = {
      fileName: getAudioFileName(customMusic.name, customMusic.uri),
      mimeType: customMusic.mimeType,
      base64
    };
  }

  return {
    ratio,
    template,
    transition,
    transitionDuration,
    musicId,
    volume,
    customMusic: encodedMusic,
    frames: encodedFrames
  };
};

export const requestTripClipRender = async (
  serverUrl: string,
  request: TripClipRenderRequest
) => {
  await assertRenderServerReady(serverUrl);
  const payload = await createTripClipRenderPayload(request);
  const response = await fetchWithTimeout(
    getRenderEndpoint(serverUrl, "/render-trip-clip"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    120000
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "영상 렌더링에 실패했습니다.");
  }

  return (await response.json()) as TripClipRenderResponse;
};

export const downloadRenderedVideo = async (videoUrl: string, fileName?: string) => {
  const outputName = fileName ?? `travel-frame-${Date.now()}.mp4`;
  const outputUri = getOutputUri(outputName);
  const result = await FileSystem.downloadAsync(videoUrl, outputUri);
  return result.uri;
};

const requestSavePermission = async (_kind: MediaPermissionKind) => getMediaLibrary();

const getAndroidDownloadDirectoryUri = async () => {
  if (androidDownloadDirectoryUri) {
    return androidDownloadDirectoryUri;
  }

  const initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download");
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);

  if (!permission.granted) {
    throw new Error("다운로드 폴더에 저장하려면 폴더 접근 권한이 필요합니다.");
  }

  androidDownloadDirectoryUri = permission.directoryUri;
  return permission.directoryUri;
};

const getImageSaveMimeType = (uri: string, format: ImageSaveFormat) => {
  if (format === "png") {
    return "image/png";
  }

  if (format === "jpeg") {
    return "image/jpeg";
  }

  return getMimeType(uri);
};

const getImageSaveExtension = (mimeType: string) => {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
};

const saveImageToAndroidDownload = async (
  uri: string,
  format: ImageSaveFormat
) => {
  const saveUri = await prepareImageForLibrarySave(uri, format);
  const mimeType = getImageSaveMimeType(saveUri, format);
  const extension = getImageSaveExtension(mimeType);
  const directoryUri = await getAndroidDownloadDirectoryUri();
  const fileName = `travel-frame-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    fileName,
    mimeType
  );
  const base64 = await FileSystem.readAsStringAsync(saveUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return `${fileName}.${extension}`;
};

export const prepareImageForLibrarySave = async (
  uri: string,
  format: ImageSaveFormat
) => {
  if (format === "original") {
    return uri;
  }

  const rendered = await manipulateAsync(
    uri,
    [],
    format === "png"
      ? { format: SaveFormat.PNG }
      : { compress: 1, format: SaveFormat.JPEG }
  );

  return rendered.uri;
};

export const saveVideoToLibrary = async (uri: string) => {
  const MediaLibrary = await requestSavePermission("video");
  try {
    await MediaLibrary.saveToLibraryAsync(uri);
  } catch (error) {
    throw normalizeMediaSaveError(error, "영상을 핸드폰 앨범에 저장하지 못했습니다.");
  }
};

export const saveImageToLibrary = async (
  uri: string,
  format: ImageSaveFormat = "original"
) => {
  try {
    if (Platform.OS === "android") {
      await saveImageToAndroidDownload(uri, format);
      return;
    }

    const MediaLibrary = await requestSavePermission("photo");
    const saveUri = await prepareImageForLibrarySave(uri, format);
    await MediaLibrary.saveToLibraryAsync(saveUri);
  } catch (error) {
    throw normalizeMediaSaveError(error, "이미지를 핸드폰 앨범에 저장하지 못했습니다.");
  }
};

const normalizeMediaSaveError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (
    message.includes("Expo Go can no longer provide full access") ||
    message.includes("requestPermissionsAsync has been rejected")
  ) {
    return new Error(
      "Expo Go Android에서는 앨범 저장 권한이 제한될 수 있습니다. 개발 빌드에서 테스트하거나 공유 기능으로 저장해 주세요."
    );
  }

  if (message.includes("permission") || message.includes("Permission")) {
    return new Error("핸드폰 앨범 저장 권한이 필요합니다.");
  }

  return error instanceof Error ? error : new Error(fallback);
};

export const shareVideo = async (uri: string) => {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error("이 기기에서는 공유 기능을 사용할 수 없습니다.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "video/mp4",
    dialogTitle: "여행 클립 공유"
  });
};

export const shareImage = async (uri: string) => {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error("이 기기에서는 공유 기능을 사용할 수 없습니다.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "image/jpeg",
    dialogTitle: "대표 이미지 공유"
  });
};
