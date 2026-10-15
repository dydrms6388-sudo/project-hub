// 취미 12 카테고리 ↔ lucide 아이콘 명시적 매핑.
// `import * as Icons from "lucide-react"` 는 전체 아이콘(4천여 개)을 번들에 넣으므로 금지 — 여기서만 named import 한다.
import {
  BookOpen, Camera, Code, Coffee, Dices, Footprints, Gamepad2, MicVocal, Music, PawPrint, Plane, Tv,
  type LucideIcon,
} from "lucide-react";

export const HOBBY_ICONS: Record<string, LucideIcon> = {
  MicVocal, Dices, Footprints, Tv, Gamepad2, Coffee, BookOpen, Camera, Code, Plane, PawPrint, Music,
};

export function hobbyIcon(iconExport: string | undefined): LucideIcon | undefined {
  return iconExport ? HOBBY_ICONS[iconExport] : undefined;
}
