import type { TripClipRatio } from "@/constants/trip-clip";

export type ImageBundleWorkItem = {
  id: string;
  kind: "image-bundle";
  title: string;
  createdAt: string;
  coverUri?: string;
  ratio: TripClipRatio;
  photoIds: string[];
  imageUris: string[];
};
