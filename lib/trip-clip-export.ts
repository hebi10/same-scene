import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

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
  const payload = await createTripClipRenderPayload(request);
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}/render-trip-clip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

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

export const saveVideoToLibrary = async (uri: string) => {
  const permission = await MediaLibrary.requestPermissionsAsync(true);

  if (!permission.granted) {
    throw new Error("영상을 저장하려면 미디어 라이브러리 권한이 필요합니다.");
  }

  await MediaLibrary.saveToLibraryAsync(uri);
};

export const saveImageToLibrary = async (uri: string) => {
  const permission = await MediaLibrary.requestPermissionsAsync(true);

  if (!permission.granted) {
    throw new Error("이미지를 저장하려면 미디어 라이브러리 권한이 필요합니다.");
  }

  await MediaLibrary.saveToLibraryAsync(uri);
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
