import * as React from "react";
import { cn } from "../../lib/cn";
import { displayLegal, isLegalPlaceholder } from "../../tokens";

/** 07_legal §1 표시 의무 9항목 + 책임자 2명. 값이 없거나 `{{PLACEHOLDER}}`면 `[TODO_사업자정보]`를 그대로 노출한다(숨기지 않음). */
export interface LegalCompanyInfo {
  companyName?: string | null;
  ceoName?: string | null;
  bizNo?: string | null;
  /** 통신판매업 신고번호 (Phase 3 전엔 플레이스홀더 가능) */
  ecomNo?: string | null;
  address?: string | null;
  email?: string | null;
  /** 선택: 플레이스홀더면 줄 자체를 렌더하지 않음 */
  phone?: string | null;
  privacyOfficer?: string | null;
  youthOfficer?: string | null;
  hostingProvider?: string | null;
}

export interface LegalLink {
  label: string;
  href: string;
}

export interface LegalFooterProps extends React.HTMLAttributes<HTMLElement> {
  company: LegalCompanyInfo;
  /** /legal/* 링크 5~6종 */
  links?: LegalLink[];
  /** Next Link 주입 */
  renderLink?: (link: LegalLink, props: { className: string; children: React.ReactNode }) => React.ReactNode;
  /** © 연도. 생략 시 현재 연도 */
  year?: number;
  /** 축약본(결제 시트 하단): 상호·대표·사업자번호·신고번호·이메일만 */
  compact?: boolean;
  /** 하단 고정 문구, 기본 "만 19세 이상만 이용할 수 있어요" */
  note?: React.ReactNode;
}

export const DEFAULT_LEGAL_LINKS: readonly LegalLink[] = [
  { label: "이용약관", href: "/legal/terms" },
  { label: "개인정보처리방침", href: "/legal/privacy" },
  { label: "위치정보 이용 안내", href: "/legal/location" },
  { label: "청소년보호정책", href: "/legal/youth" },
  { label: "사업자 정보", href: "/legal/business" },
];

/**
 * LegalFooter — 사업자 정보 블록(web·company 공용). 값은 props로만 받는다(리터럴 없음).
 * 텍스트 최소 12px(caption), 색 neutral-600 이상. 법적 문구는 "~합니다"체 허용 예외.
 */
export const LegalFooter = React.forwardRef<HTMLElement, LegalFooterProps>(
  ({ company, links = DEFAULT_LEGAL_LINKS, renderLink, year, compact = false, note = "만 19세 이상만 이용할 수 있어요", className, ...props }, ref) => {
    const y = year ?? new Date().getFullYear();
    const rows: Array<[string, string | null | undefined, boolean]> = compact
      ? [
          ["상호", company.companyName, true],
          ["대표", company.ceoName, true],
          ["사업자등록번호", company.bizNo, true],
          ["통신판매업 신고", company.ecomNo, true],
          ["이메일", company.email, true],
        ]
      : [
          ["상호", company.companyName, true],
          ["대표", company.ceoName, true],
          ["사업자등록번호", company.bizNo, true],
          ["통신판매업 신고", company.ecomNo, true],
          ["주소", company.address, true],
          ["이메일", company.email, true],
          ["전화", company.phone, false],
          ["개인정보보호책임자", company.privacyOfficer, true],
          ["청소년보호책임자", company.youthOfficer, true],
          ["호스팅 서비스 제공", company.hostingProvider ?? "Vercel Inc.", true],
        ];
    const linkCls = "text-caption text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

    return (
      <footer ref={ref} className={cn("border-t border-border bg-background px-5 py-6 text-caption text-muted-foreground", className)} {...props}>
        {!compact && links.length > 0 ? (
          <nav aria-label="법적 고지">
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
              {links.map((l) => (
                <li key={l.href}>{renderLink ? renderLink(l, { className: linkCls, children: l.label }) : <a href={l.href} className={linkCls}>{l.label}</a>}</li>
              ))}
            </ul>
          </nav>
        ) : null}
        <dl className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1", !compact && "mt-4")} aria-label="사업자 정보">
          {rows.map(([k, v, required]) => {
            if (!required && isLegalPlaceholder(v)) return null;
            return (
              <React.Fragment key={k}>
                <dt className="whitespace-nowrap">{k}</dt>
                <dd className="break-all">{displayLegal(v)}</dd>
              </React.Fragment>
            );
          })}
        </dl>
        {!compact ? (
          <p className="mt-4">
            <span className="tnum">© {y}</span> {displayLegal(company.companyName)}
            {note ? <span className="ml-2">· {note}</span> : null}
          </p>
        ) : null}
      </footer>
    );
  },
);
LegalFooter.displayName = "LegalFooter";
