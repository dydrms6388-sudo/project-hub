import type { SoundContent } from "./types";
import { illusionContent } from "./illusion";
import { psychoContent } from "./psycho";
import { spatialContent } from "./spatial";
import { synthesisContent } from "./synthesis";

export const contents: Record<string, SoundContent> = {
  ...illusionContent,
  ...psychoContent,
  ...spatialContent,
  ...synthesisContent,
};
