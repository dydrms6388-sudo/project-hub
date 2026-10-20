import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BlockedList } from "@/components/me/blocked-list";
import { withUser } from "@/lib/server/db";
import { listBlocked } from "@/lib/server/repo";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "차단 목록" };

export default async function BlockedPage() {
  const { session } = await requireViewer();
  const items = await withUser(session.claims, (db) => listBlocked(db));
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Link href="/me" aria-label="뒤로" className="-ml-2 flex size-9 items-center justify-center rounded-full hover:bg-secondary">
              <ChevronLeft className="size-6" />
            </Link>
            차단 목록
          </span>
        }
      />
      <BlockedList items={items} />
      <p className="mt-3 px-1 text-xs text-muted-foreground">차단을 해제해도 이전 매칭은 복구되지 않아요.</p>
    </div>
  );
}
