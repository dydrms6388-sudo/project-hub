// D8 · /admin/photos — 사진 검수 큐 (F-ADM-02)
// pending 오래된 순(FIFO). 카드 1장 = 사진 1장 = 확정 1건.
// 승인 시 Lv2 → Lv3 승급, 반려로 승인 사진이 0장이 되면 Lv3 → Lv2 강등 —
// 판정은 전부 lib/admin/photos 안에서 일어난다(화면은 결과 문구만 표시).
// 이미지는 service role 이 발급한 10분 만료 서명 URL 로만 노출한다(원본 경로 비노출).

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  VerifyLevelBadge,
} from "@duckmate/ui";
import type { VerifyLevel } from "@duckmate/ui";
import { PHOTO_REJECT_REASONS, listPendingPhotos } from "@/lib/admin/photos";
import { Flash, flashFrom } from "../_components/flash";
import { approvePhotoAction, rejectPhotoAction } from "./actions";

export const dynamic = "force-dynamic";

const REJECT_CODES = Object.entries(PHOTO_REJECT_REASONS) as [
  keyof typeof PHOTO_REJECT_REASONS,
  string,
][];

/** 대기 시간 — 오래 묵은 건을 눈에 띄게 (검수 SLA 는 A5 §1.1 "24시간 내") */
function waitedFor(createdAt: string): { text: string; overdue: boolean } {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { text: h > 0 ? `${h}시간 ${m}분 대기` : `${m}분 대기`, overdue: h >= 24 };
}

export default async function PhotoReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const res = await listPendingPhotos(50);
  if (!res.ok) return <p className="text-body text-danger">{res.message}</p>;
  const rows = res.data;

  return (
    <div className="flex flex-col gap-4">
      <Flash {...flashFrom(sp)} />
      <header className="flex items-center justify-between">
        <h1 className="text-h1">사진 검수</h1>
        <p className="text-caption text-ink-muted">
          오래 대기한 순 · 대기 {rows.length}건 (최대 50건 표시)
        </p>
      </header>

      <p className="rounded-md border border-line bg-surface-raised p-3 text-caption text-ink-muted">
        검수 기준: 얼굴 식별 가능 · 본인 사진 · 연락처/개인정보 노출 없음 · 부적절 콘텐츠 없음.
        확정(승인/반려)은 번복할 수 없고 재검수는 새 업로드로만 진행됩니다. 모든 확정은 감사로그에
        기록됩니다.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-md border border-line bg-surface-raised p-6 text-body text-ink-muted">
          검수 대기 중인 사진이 없어요.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ photo, nickname, verifyLevel, signedUrl, approvedCount }) => {
            const waited = waitedFor(photo.created_at);
            const willPromote = verifyLevel === 2;
            return (
              <Card key={photo.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/users/${photo.profile_id}`} className="underline">
                      {nickname ?? "(닉네임 없음)"}
                    </Link>
                    <VerifyLevelBadge level={(verifyLevel ?? 0) as VerifyLevel} compact />
                    {photo.is_primary ? <Badge variant="brand">대표 사진</Badge> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="overflow-hidden rounded-md border border-line bg-surface">
                    {signedUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={signedUrl}
                        alt={`검수 대기 사진 — ${nickname ?? photo.profile_id}`}
                        className="h-72 w-full object-contain"
                      />
                    ) : (
                      <p className="p-6 text-body-sm text-danger">
                        서명 URL 발급 실패 — 스토리지 객체 확인 필요 (경로: {photo.path})
                      </p>
                    )}
                  </div>

                  <p className="text-caption text-ink-muted">
                    <span className={waited.overdue ? "text-danger" : undefined}>{waited.text}</span> ·
                    업로드{" "}
                    {new Date(photo.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} ·
                    승인 사진 {approvedCount}장
                  </p>
                  {willPromote ? (
                    <p className="text-caption text-success">
                      승인하면 인증 레벨 3(사진 인증)으로 승급합니다.
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-2 border-t border-line pt-3">
                    <form action={approvePhotoAction}>
                      <input type="hidden" name="photoId" value={photo.id} />
                      <Button type="submit" variant="primary" size="md" className="w-full">
                        승인
                      </Button>
                    </form>

                    <form action={rejectPhotoAction} className="flex flex-col gap-2">
                      <input type="hidden" name="photoId" value={photo.id} />
                      <label className="flex flex-col gap-1 text-caption text-ink-muted">
                        반려 사유 (필수 — 유저 화면에 그대로 노출)
                        <Select name="reasonCode" defaultValue="" required>
                          <option value="">선택</option>
                          {REJECT_CODES.map(([code, label]) => (
                            <option key={code} value={code}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        반려
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
