import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn 스타일 클래스 병합: clsx 조건부 + tailwind-merge 충돌 제거. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
