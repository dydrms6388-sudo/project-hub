import { Heart, MessageCircleHeart, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { LikeBackButton } from "@/components/likes/like-back-button";
import { AvailabilityBadge, PresenceDot } from "@/components/profile/badges";
import { ProfilePhoto } from "@/components/profile/photo";
import { withUser } from "@/lib/server/db";
import { listLikes, listMatches } from "@/lib/server/repo";
import { requireViewer } from "@/lib/server/viewer";
import type { ProfileCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "좋아요·매칭" };

const TABS = [
  { key: "matches", label: "매칭" },
  { key: "received", label: "받은 좋아요" },
  { key: "sent", label: "보낸 좋아요" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function since(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default async function LikesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : "matches";
  const { session } = await requireViewer();
  const data = await withUser(session.claims, async (db) => ({
    matches: await listMatches(db, session.userId),
    received: await listLikes(db, session.userId, "received"),
    sent: await listLikes(db, session.userId, "sent"),
  }));
  const counts = { matches: data.matches.length, received: data.received.length, sent: data.sent.length };

  return (
    <>
      <PageHeader title="좋아요·매칭" />
      <nav className="bg-secondary/60 mb-4 flex gap-1 rounded-2xl p-1" aria-label="좋아요 탭">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/likes?tab=${t.key}`}
            replace
            aria-current={tab === t.key ? "page" : undefined}
            data-testid={`tab-${t.key}`}
            className={cn(
              "flex-1 rounded-xl py-2 text-center text-sm font-medium transition-colors",
              tab === t.key ? "bg-background text-foreground shadow" : "text-muted-foreground",
            )}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="text-primary ml-1 text-xs">{counts[t.key]}</span>}
          </Link>
        ))}
      </nav>

      {tab === "matches" &&
        (data.matches.length ? (
          <ul className="grid gap-2 md:grid-cols-2" data-testid="match-list">
            {data.matches.map((m) => (
              <PersonRow
                key={m.match_id}
                p={m.profile}
                meta={`${since(m.matched_at)} 매칭`}
                action={
                  <Link
                    href={`/p/${m.profile.id}#contact`}
                    className="bg-brand rounded-xl px-3 py-2 text-sm font-semibold text-white"
                    data-testid="match-contact"
                  >
                    연락하기
                  </Link>
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<MessageCircleHeart />}
            title="아직 매칭이 없어요"
            description="서로 좋아요를 누르면 매칭되고, 상대가 매칭 상대에게 공개한 연락 방법을 볼 수 있어요."
            action={
              <Link href="/swipe" className="bg-brand mt-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
                스와이프 하러 가기
              </Link>
            }
          />
        ))}

      {tab === "received" &&
        (data.received.length ? (
          <ul className="grid gap-2 md:grid-cols-2" data-testid="received-list">
            {data.received.map((l) => (
              <PersonRow
                key={l.profile.id}
                p={l.profile}
                meta={`${since(l.created_at)} 좋아요`}
                action={<LikeBackButton targetId={l.profile.id} nickname={l.profile.nickname} />}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Heart />}
            title="받은 좋아요가 없어요"
            description="사진과 자기소개를 채우면 더 많은 관심을 받아요."
          />
        ))}

      {tab === "sent" &&
        (data.sent.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {data.sent.map((l) => (
              <PersonRow key={l.profile.id} p={l.profile} meta={`${since(l.created_at)} 보냄`} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Send />} title="보낸 좋아요가 없어요" />
        ))}
    </>
  );
}

function PersonRow({ p, meta, action }: { p: ProfileCard; meta: string; action?: React.ReactNode }) {
  return (
    <li className="bg-card flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-white/5">
      <Link href={`/p/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full">
          <ProfilePhoto photoId={p.primary_photo_id} name={p.nickname} seed={p.id} className="size-full text-lg" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-semibold">
            <PresenceDot presence={p.presence} />
            {p.nickname} <span className="text-muted-foreground font-normal">{p.age}</span>
            <AvailabilityBadge availability={p.availability} />
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {[p.sido, p.sigungu].filter(Boolean).join(" ")} · {meta}
          </p>
        </div>
      </Link>
      {action}
    </li>
  );
}
