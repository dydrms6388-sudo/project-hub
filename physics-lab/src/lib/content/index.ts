import { ExpContent } from "./types";
import { oscillationContent } from "./oscillation";
import { chaosContent } from "./chaos";
import { gravityMechanicsContent } from "./gravityMechanics";
import { waveFluidEmContent } from "./waveFluidEm";

export const contents: Record<string, ExpContent> = {
  ...oscillationContent,
  ...chaosContent,
  ...gravityMechanicsContent,
  ...waveFluidEmContent,
};

export type { ExpContent } from "./types";
