"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { specs } from "@/data/specs";

function Loading() {
  return (
    <div
      className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500"
      role="status"
      aria-live="polite"
    >
      도구를 불러오는 중…
    </div>
  );
}

/**
 * slug → 컴포넌트 맵.
 * 모든 규격 페이지가 같은 편집기(`impl/idphoto`)를 쓰고 spec 만 다르게 주입받는다.
 * react-easy-crop / pdf-lib / transformers 는 전부 이 dynamic import 뒤에서만 로드되므로
 * 초기 번들에는 들어가지 않는다. (transformers 는 추가로 버튼 클릭 시점의 await import)
 */
const forSlug = (slug: string) =>
  dynamic(
    async () => {
      const mod = await import("./impl/idphoto");
      const Tool = mod.default;
      const Bound = () => <Tool slug={slug} />;
      Bound.displayName = `IdPhotoTool(${slug})`;
      return Bound;
    },
    { ssr: false, loading: Loading },
  );

export const componentMap: Record<string, ComponentType> = Object.fromEntries(
  specs.map((s) => [s.slug, forSlug(s.slug)]),
);
