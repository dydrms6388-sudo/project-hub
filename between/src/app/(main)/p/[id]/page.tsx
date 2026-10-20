import { ArrowLeft, Lock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AvailabilityBadge, PresenceDot } from "@/components/profile/badges";
import { ContactLinks } from "@/components/profile/contact-links";
import { PhotoCarousel } from "@/components/profile/photo-carousel";
import { ProfileActions } from "@/components/profile/profile-actions";
import { bodySummary, detailSections, presenceLabel, regionLabel } from "@/lib/domain/format";
import { withUser } from "@/lib/server/db";
import { getCard, listContacts, listPhotos, myRelation } from "@/lib/server/repo";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "프로필", robots: { index: false, follow: false } };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { session } = await requireViewer();
  const isSelf = id === session.userId;

  const data = await withUser(session.claims, async (db) => {
    const card = await getCard(db, id);
    if (!card) return null;
    // 한 트랜잭션(=한 커넥션)에서는 쿼리를 순차 실행한다
    const photos = await listPhotos(db, id);
    const contacts = await listContacts(db, id);
    const relation = isSelf ? null : await myRelation(db, session.userId, id);
    return { card, photos, contacts, relation };
  });

  if (!data) {
    if (isSelf) {
      return (
        <div className="py-16 text-center text-sm text-muted-foreground">
          내 프로필이 현재 숨김·만료·제한 상태라 다른 사람에게 보이지 않아요.{" "}
          <Link href="/me" className="text-primary underline">
            내 프로필로
          </Link>
        </div>
      );
    }
    notFound();
  }
  const { card, photos, contacts, relation } = data;
  // 내 프로필 미리보기에서는 "타인에게 보이는 사진"만 보여준다 (매칭 전용 사진 제외)
  const visiblePhotos = isSelf ? photos.filter((p) => p.visibility === "public") : photos;
  const matched = !!relation?.match_id;
  const hasHiddenContacts = !isSelf && !matched;

  return (
    <article className="-mx-4 pb-28 md:mx-auto md:max-w-xl">
      <div className="relative">
        <PhotoCarousel photos={visiblePhotos.map((p) => p.id)} name={card.nickname} seed={card.id} />
        <Link
          href={isSelf ? "/me" : "/explore"}
          aria-label="뒤로"
          className="absolute top-[max(env(safe-area-inset-top),12px)] left-3 flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
        >
          <ArrowLeft className="size-5" />
        </Link>
        {isSelf && (
          <span className="absolute top-[max(env(safe-area-inset-top),12px)] right-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            다른 사람에게 보이는 모습
          </span>
        )}
      </div>

      <div className="space-y-5 px-4 pt-4">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold tracking-tight" data-testid="profile-name">
              {card.nickname} <span className="font-medium text-muted-foreground">{card.age}</span>
            </h1>
            <AvailabilityBadge availability={card.availability} />
            {card.is_new && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-black">NEW</span>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {regionLabel(card)}
            <span className="mx-1">·</span>
            <PresenceDot presence={card.presence} /> {presenceLabel(card.presence)}
          </p>
          {bodySummary(card) && <p className="mt-1 text-sm">{bodySummary(card)}</p>}
          {relation?.liked_me && !matched && (
            <p className="mt-3 rounded-xl bg-accent/15 px-3 py-2 text-sm font-medium text-accent">
              {card.nickname}님이 나를 좋아해요. 좋아요를 보내면 바로 매칭돼요!
            </p>
          )}
          {matched && (
            <p className="mt-3 rounded-xl bg-primary/15 px-3 py-2 text-sm font-medium text-primary" data-testid="matched-banner">
              서로 좋아요한 매칭 상대예요.
            </p>
          )}
        </header>

        {card.bio && (
          <section className="rounded-2xl bg-card p-4 ring-1 ring-white/5">
            <h2 className="mb-1.5 text-xs font-semibold text-muted-foreground">자기소개</h2>
            <p className="text-[15px] leading-relaxed whitespace-pre-line">{card.bio}</p>
          </section>
        )}

        {detailSections(card).map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 text-xs font-semibold text-muted-foreground">{s.title}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {s.items.map((it) => (
                <li key={it} className="rounded-full bg-secondary px-3 py-1 text-sm">
                  {it}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section id="contact" className="rounded-2xl bg-card p-4 ring-1 ring-white/5">
          <h2 className="mb-3 text-sm font-semibold">연락 방법</h2>
          {contacts.length > 0 ? (
            <ContactLinks contacts={contacts} nickname={card.nickname} />
          ) : (
            <p className="text-sm text-muted-foreground">공개된 연락 방법이 없어요.</p>
          )}
          {hasHiddenContacts && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> 매칭되면 상대가 &lsquo;매칭 상대만&rsquo;으로 설정한 연락 방법도 보여요.
            </p>
          )}
        </section>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          처음 만날 땐 사람이 많은 공공장소에서 만나고, 금전 요구는 바로 신고해 주세요.{" "}
          <Link href="/safety" className="underline">
            안전 가이드
          </Link>
        </p>
      </div>

      {!isSelf && relation && (
        <ProfileActions
          targetId={card.id}
          nickname={card.nickname}
          mySwipe={relation.my_swipe}
          matchId={relation.match_id}
        />
      )}
    </article>
  );
}
