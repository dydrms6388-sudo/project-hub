import type { Builder } from "../types";
import { illusionBuilders } from "./illusion";
import { psychoBuilders } from "./psycho";
import { spatialBuilders } from "./spatial";
import { synthesisBuilders } from "./synthesis";

export const builders: Record<string, Builder> = {
  ...illusionBuilders,
  ...psychoBuilders,
  ...spatialBuilders,
  ...synthesisBuilders,
};
