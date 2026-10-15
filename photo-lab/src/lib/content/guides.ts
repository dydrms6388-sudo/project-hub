import { GuideContent } from "./types";
import { GUIDES_1 } from "./guides1";
import { GUIDES_2 } from "./guides2";

export const GUIDE_CONTENT: Record<string, GuideContent> = {
  ...GUIDES_1,
  ...GUIDES_2,
};
