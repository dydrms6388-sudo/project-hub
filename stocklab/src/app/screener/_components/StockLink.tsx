import { naverFinanceHref } from "./utils";

/** 종목명 → 외부 정보 페이지(네이버 금융) 링크. 정보 열람용 외부 링크일 뿐 매매 권유가 아닙니다. */
export function StockLink({ code, name }: { code: string; name: string }) {
  return (
    <a
      href={naverFinanceHref(code)}
      target="_blank"
      rel="noopener nofollow"
      className="font-semibold text-fg underline-offset-2 hover:underline"
      aria-label={`${name} 외부 정보 페이지 (새 창)`}
    >
      {name}
      <span className="ml-1 text-[11px] font-normal text-muted tnum">{code}</span>
    </a>
  );
}
