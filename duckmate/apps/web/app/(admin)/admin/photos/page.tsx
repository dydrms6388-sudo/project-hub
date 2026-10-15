import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { listPhotoQueue, parsePhotoFilters } from "@/lib/admin/queries";
import { PhotoReviewGrid } from "../../_components/PhotoReviewGrid";
import { Pagination } from "../../_components/Pagination";

export default async function PhotosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAdminPage("moderator");
  const f = parsePhotoFilters(await searchParams);
  const page = await listPhotoQueue(ctx.admin, f);
  const tab = (s: "both" | "pending" | "held", label: string) => (
    <Link href={`/admin/photos?status=${s}`} className={`rounded-md px-3 py-1.5 text-label ${f.status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-h1">사진 검수</h1>
        <p className="text-body-sm text-muted-foreground">업로드순. 대표 사진은 얼굴이 명확한 본인 사진만 승인(A5 §8). 자동 반려 없음 — 얼굴 검사 값은 참고용.</p>
      </header>
      <div className="flex gap-1">
        {tab("both", "대기 + 보류")}
        {tab("pending", "pending")}
        {tab("held", "held")}
      </div>
      <PhotoReviewGrid items={page.items} />
      <Pagination page={page.page} pageSize={page.pageSize} total={page.total} hrefFor={(p) => `/admin/photos?status=${f.status}&page=${p}`} />
    </div>
  );
}
