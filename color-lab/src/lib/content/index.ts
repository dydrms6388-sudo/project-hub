import type { ColorContent } from "./types";
import { WARM_CONTENT } from "./warm";
import { GREEN_CYAN_CONTENT } from "./green-cyan";
import { COOL_NEUTRAL_CONTENT } from "./cool-neutral";

export type { ColorContent, SectionKey } from "./types";

export const COLOR_CONTENT: Record<string, ColorContent> = {
  ...WARM_CONTENT,
  ...GREEN_CYAN_CONTENT,
  ...COOL_NEUTRAL_CONTENT,
};
