"use client";

import IdPhotoEditor from "@/components/idphoto/IdPhotoEditor";
import { specBySlug } from "@/data/specs";

/**
 * 규격 페이지 공통 진입점.
 * 페이지마다 컴포넌트를 복제하지 않고, specs.ts 의 규격 하나만 주입한다.
 */
export default function IdPhotoTool({ slug }: { slug: string }) {
  const spec = specBySlug(slug);
  if (!spec) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        규격 정보를 찾지 못했습니다.
      </div>
    );
  }
  return <IdPhotoEditor spec={spec} />;
}
