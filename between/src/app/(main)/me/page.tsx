import { CalendarClock, EyeOff, Pencil, ShieldAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { AccountSection } from "@/components/me/account-section";
import { ActivitySelector } from "@/components/me/activity-selector";
import { ContactsManager } from "@/components/me/contacts-manager";
import { PhotoManager } from "@/components/me/photo-manager";
import { PrivacySettings } from "@/components/me/privacy-settings";
import { Section } from "@/components/me/section";
import { ProfilePhoto } from "@/components/profile/photo";
import { regionLabel } from "@/lib/domain/format";
import { withUser } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { getActivity, listContacts, listPhotos } from "@/lib/server/repo";
import { isRestricted, requireViewer } from "@/lib/server/viewer";
import { ageFromBirthYear } from "@/lib/validation/profile";

export const metadata: Metadata = { title: "내 프로필" };

export default async function MePage() {
  const { session, profile } = await requireViewer();
  // 한 트랜잭션(=한 커넥션)에서는 쿼리를 순차 실행한다
  const { photos, contacts, activity } = await withUser(session.claims, async (db) => ({
    photos: await listPhotos(db, session.userId),
    contacts: await listContacts(db, session.userId),
    activity: await getActivity(db, session.userId),
  }));
  const restricted = isRestricted(profile);
  const expires = profile.expires_at ? new Date(profile.expires_at) : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="내 프로필" />

      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-white/5">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl ring-2 ring-primary/60">
          <ProfilePhoto
            photoId={photos[0]?.id ?? null}
            name={profile.nickname}
            seed={profile.id}
            className="size-full text-2xl"
            priority
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold" data-testid="my-nickname">
            {profile.nickname} <span className="font-medium text-muted-foreground">{ageFromBirthYear(profile.birth_year)}</span>
          </p>
          <p className="truncate text-sm text-muted-foreground">{regionLabel(profile)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.is_hidden && (
              <StatusChip>
                <EyeOff className="size-3" /> 숨김 중
              </StatusChip>
            )}
            {expires && (
              <StatusChip>
                <CalendarClock className="size-3" />
                {expires.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 만료
              </StatusChip>
            )}
            {restricted && (
              <StatusChip danger>
                <ShieldAlert className="size-3" /> {restricted === "banned" ? "이용 제한" : "일시 정지"}
              </StatusChip>
            )}
          </div>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2">
        <Link
          href="/me/edit"
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-bold text-white"
          data-testid="edit-profile"
        >
          <Pencil className="size-4" /> 프로필 수정
        </Link>
        <Link
          href={`/p/${profile.id}`}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-semibold"
        >
          <UserRound className="size-4" /> 미리보기
        </Link>
      </div>

      <Section title="지금 만나기" id="activity">
        <ActivitySelector initial={activity} />
      </Section>

      <Section title={`사진 (${photos.length}/5)`} id="photos">
        <PhotoManager photos={photos} nickname={profile.nickname} />
      </Section>

      <Section
        title="연락 방법"
        id="contacts"
        description="연락처는 입력하지 않아도 돼요. 매칭 상대에게만 공개를 권장해요. 링크는 서버에서 검증되며 단축 URL·리다이렉트 링크는 등록할 수 없어요."
      >
        <ContactsManager contacts={contacts} />
      </Section>

      <Section title="개인정보·노출" id="privacy">
        <PrivacySettings hidden={profile.is_hidden} expiresAt={profile.expires_at} />
      </Section>

      <AccountSection provider={env().AUTH_PROVIDER} isAnonymous={session.isAnonymous} />
    </div>
  );
}

function StatusChip({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      className={
        danger
          ? "inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive"
          : "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}
