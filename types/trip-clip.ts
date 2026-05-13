import type {
  MusicTrack,
  TripClipRatio,
  TripClipTemplate,
  TripClipTransition
} from "@/constants/trip-clip";
import type { PhotoItem } from "@/types/photo";

export type TripClipFrame = {
  photo: PhotoItem;
  duration: number;
};

export type TripClipRenderSettings = {
  ratio: TripClipRatio;
  template: TripClipTemplate;
  transition: TripClipTransition;
  transitionDuration: number;
  musicId: MusicTrack["id"] | "custom";
  volume: number;
  customMusic?: {
    uri: string;
    name: string;
    mimeType?: string;
  };
};

export type TripClipRenderRequest = TripClipRenderSettings & {
  frames: TripClipFrame[];
};

export type TripClipRenderResponse = {
  videoUrl: string;
  fileName?: string;
};
