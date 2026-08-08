import type { SoundContent } from "./types";
import illusion from "./illusion";
import psychoacoustics from "./psychoacoustics";
import spatial from "./spatial";
import synthesis from "./synthesis";
import effects from "./effects";

export const allContent: Record<string, SoundContent> = {
  ...illusion,
  ...psychoacoustics,
  ...spatial,
  ...synthesis,
  ...effects,
};

export function getContent(slug: string): SoundContent | undefined {
  return allContent[slug];
}

export const SECTION_TITLES: Record<string, string> = {
  hear: "무엇이 들리는가",
  signal: "실제 신호는 무엇인가",
  why: "왜 그렇게 들리는가",
  history: "발견 경위와 연구사",
};
