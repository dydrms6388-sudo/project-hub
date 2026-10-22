import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/app/bottom-nav";
import { isRestricted, requireViewer } from "@/lib/server/viewer";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireViewer();
  const restricted = isRestricted(profile);
  return (
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-24">
      {restricted && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 mt-3 flex gap-3 rounded-2xl border p-4 text-sm"
        >
          <ShieldAlert className="text-destructive size-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {restricted === "banned"
                ? "운영정책 위반으로 이용이 제한된 계정이에요."
                : "신고 검토를 위해 계정이 일시 제한됐어요."}
            </p>
            <p className="text-muted-foreground mt-1">
              제한 기간 동안 다른 사람의 프로필이 보이지 않고, 내 프로필도 노출되지 않아요.{" "}
              {profile.suspended_until &&
                `해제 예정: ${new Date(profile.suspended_until).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`}{" "}
              <Link href="/safety" className="underline">
                운영정책 보기
              </Link>
            </p>
          </div>
        </div>
      )}
      {children}
      <BottomNav />
    </div>
  );
}
