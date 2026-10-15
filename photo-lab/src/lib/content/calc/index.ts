import { CalcContent } from "../types";
import { depthContent } from "./depth";
import { astroContent } from "./astro";
import { exposureContent } from "./exposure";
import { miscContent } from "./misc";

export const CALC_CONTENT: Record<string, CalcContent> = {
  ...depthContent,
  ...astroContent,
  ...exposureContent,
  ...miscContent,
};
