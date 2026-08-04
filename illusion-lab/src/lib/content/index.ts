import { IllusionContent } from "./types";
import { geometrySizeContent } from "./geometrySize";
import { geometryAngleContent } from "./geometryAngle";
import { brightnessContent } from "./brightness";
import { colorContourContent } from "./colorContour";
import { fadingContent } from "./fading";
import { motionContent } from "./motion";
import { ambiguousContent } from "./ambiguous";

export const contents: Record<string, IllusionContent> = {
  ...geometrySizeContent,
  ...geometryAngleContent,
  ...brightnessContent,
  ...colorContourContent,
  ...fadingContent,
  ...motionContent,
  ...ambiguousContent,
};

export type { IllusionContent, Faq } from "./types";
