import type { MusicTrack, TripClipRatio, TripClipTemplate, TripClipTransition } from "@/constants/trip-clip";

export type MadeVideoItem = {
  id: string;
  uri: string;
  coverUri?: string;
  createdAt: string;
  title: string;
  ratio: TripClipRatio;
  template: TripClipTemplate;
  transition: TripClipTransition;
  transitionDuration: number;
  duration: number;
  photoIds: string[];
  durations: Record<string, number>;
  musicId: MusicTrack["id"] | "custom";
  musicLabel: string;
};
