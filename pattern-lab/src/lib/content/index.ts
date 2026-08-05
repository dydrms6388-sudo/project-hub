import { PatternContent } from "./types";
import { curvesSpiralsContent } from "./curvesSpirals";
import { fractalsContent } from "./fractals";
import { tilingsFieldsContent } from "./tilingsFields";
import { chaosNumberContent } from "./chaosNumber";

export const contents: Record<string, PatternContent> = {
  ...curvesSpiralsContent,
  ...fractalsContent,
  ...tilingsFieldsContent,
  ...chaosNumberContent,
};

export type { PatternContent } from "./types";
