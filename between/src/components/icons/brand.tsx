// 외부 메신저 브랜드 아이콘 (lucide 는 브랜드 아이콘을 제공하지 않음). 단순화한 자체 SVG.
import { Link2 } from "lucide-react";
import type { ContactKind } from "@/lib/domain/options";
import { cn } from "@/lib/utils";

type P = { className?: string };

export function KakaoIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.5c-5.25 0-9.5 3.3-9.5 7.38 0 2.64 1.78 4.95 4.45 6.26l-.92 3.37c-.08.3.26.54.52.37l4.03-2.66c.47.05.94.08 1.42.08 5.25 0 9.5-3.3 9.5-7.42S17.25 3.5 12 3.5Z"
      />
    </svg>
  );
}

export function LineIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.6 2 11.04c0 3.98 3.54 7.31 8.33 7.94.32.07.77.21.88.49.1.25.07.65.03.9l-.14.85c-.04.25-.2.98.86.53 1.06-.45 5.73-3.38 7.82-5.78C21.23 14.37 22 12.79 22 11.04 22 6.6 17.52 3 12 3Zm-3.6 10.4H6.4a.5.5 0 0 1-.5-.5V8.9a.5.5 0 0 1 1 0v3.5h1.5a.5.5 0 0 1 0 1Zm1.9-.5a.5.5 0 0 1-1 0V8.9a.5.5 0 0 1 1 0v4Zm4.6 0a.5.5 0 0 1-.9.3l-2-2.73v2.43a.5.5 0 0 1-1 0V8.9a.5.5 0 0 1 .9-.3l2 2.73V8.9a.5.5 0 0 1 1 0v4Zm3.1-2.5a.5.5 0 0 1 0 1h-1.5v1h1.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5V8.9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-1.5v1h1.5Z"
      />
    </svg>
  );
}

export function InstagramIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TelegramIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.7 4.3 2.9 11.5c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.8-.4l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.8-.8l3.2-15.1c.3-1.3-.5-1.9-1.6-1.6ZM9.7 14.6l-.4 3.9-1.4-4.4 9.9-6.3-8.1 6.8Z"
      />
    </svg>
  );
}

export const CONTACT_STYLE: Record<ContactKind, { bg: string; fg: string; Icon: (p: P) => React.ReactElement }> = {
  kakao_openchat: { bg: "bg-[#FEE500]", fg: "text-[#191600]", Icon: KakaoIcon },
  line: { bg: "bg-[#06C755]", fg: "text-white", Icon: LineIcon },
  instagram: {
    bg: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
    fg: "text-white",
    Icon: InstagramIcon,
  },
  telegram: { bg: "bg-[#229ED9]", fg: "text-white", Icon: TelegramIcon },
  link: { bg: "bg-secondary", fg: "text-foreground", Icon: ({ className }) => <Link2 className={className} /> },
};

export function ContactIcon({ kind, className }: { kind: ContactKind; className?: string }) {
  const s = CONTACT_STYLE[kind];
  return (
    <span className={cn("inline-flex size-9 items-center justify-center rounded-full", s.bg, s.fg, className)}>
      <s.Icon className="size-5" />
    </span>
  );
}
