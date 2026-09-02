"use client";

import { componentMap } from "@/tools/components";

export default function ToolMount({ slug }: { slug: string }) {
  const Cmp = componentMap[slug];
  if (!Cmp) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        이 도구를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }
  return <Cmp />;
}
