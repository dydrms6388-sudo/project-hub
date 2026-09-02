"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Enums, VerifyLevel } from "@duckmate/db";
import { Button, VERIFY_LABELS, useToast } from "@duckmate/ui";
import { signOut } from "@/app/(auth)/actions";
import { LEGAL_LINKS } from "@/components/legal/links";
import { MODE_COPY, SUBSCRIPTION_COPY } from "./copy";
import { track } from "./track";

type Props = {
  mode: Enums["profile_mode"];
  verifyLevel: VerifyLevel;
  blockCount: number;
  canAppeal: boolean;
  paymentsEnabled: boolean;
  companyContactUrl: string | null;
  appVersion: string;
};

function Row({ href, label, meta, testId, external }: { href: string; label: string; meta?: string; testId?: string; external?: boolean }) {
  const cls = "flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted";
  const body = (
    <>
      <span className="text-body flex-1">{label}</span>
      {meta ? <span className="text-body-sm tnum text-muted-foreground">{meta}</span> : null}
      <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
    </>
  );
  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={testId}>
          {body}
        </a>
      ) : (
        <Link href={href} className={cls} data-testid={testId}>
          {body}
        </Link>
      )}
    </li>
  );
}

export function SettingsHubScreen({ mode, verifyLevel, blockCount, canAppeal, paymentsEnabled, companyContactUrl, appVersion }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  useEffect(() => {
    track("settings_viewed", { verify_level: verifyLevel, mode });
  }, [verifyLevel, mode]);

  const logout = () =>
    start(async () => {
      const r = await signOut();
      if (!r.ok) {
        toast({ title: r.message, variant: "error" });
        return;
      }
      track("logged_out");
      router.replace(r.data.redirectTo);
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="settings-hub">
      <header className="flex h-14 items-center gap-2">
        <Link href="/me" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">설정</h1>
      </header>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        <Row href="/settings/mode" label="모드" meta={MODE_COPY[mode].label} testId="settings-mode" />
        <Row href="/settings/verify" label="인증 센터" meta={`L${verifyLevel} ${VERIFY_LABELS[verifyLevel]}`} testId="settings-verify" />
        <Row href="/settings/subscription" label="구독" meta={paymentsEnabled ? undefined : SUBSCRIPTION_COPY.priceTbd} testId="settings-subscription" />
        <Row href="/settings/notifications" label="알림" testId="settings-notifications" />
        <Row href="/blocks" label="차단 관리" meta={blockCount > 0 ? `${blockCount}명` : undefined} testId="settings-blocks" />
        <Row href="/settings/data" label="내 데이터 · 계정" meta="다운로드 · 휴면 · 삭제" testId="settings-data" />
        {canAppeal ? <Row href="/appeal" label="이의신청" testId="settings-appeal" /> : null}
      </ul>

      <h2 className="text-label mt-6 px-1 text-muted-foreground">문서 · 문의</h2>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
        {LEGAL_LINKS.map((l) => (
          <Row key={l.href} href={l.href} label={l.label} />
        ))}
        {companyContactUrl ? <Row href={companyContactUrl} label="문의하기" external testId="settings-contact" /> : null}
      </ul>

      <Button variant="outline" className="mt-6 w-full" onClick={logout} loading={pending} data-testid="settings-logout">
        로그아웃
      </Button>
      <p className="tnum text-caption mt-6 text-center text-muted-foreground">앱 버전 {appVersion}</p>
    </div>
  );
}
