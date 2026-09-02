"use client";
import { useRouter } from "next/navigation";
import { StockSearch } from "@/components/StockSearch";
import type { Stock } from "@/lib/types";

/** 검색 → /check/{code} 이동만 담당하는 얇은 클라이언트 래퍼 */
export function CheckSearchBox() {
  const router = useRouter();
  function go(s: Stock) {
    router.push(`/check/${s.code}`);
  }
  return (
    <StockSearch
      onSelect={go}
      label="팩트체크할 종목 검색"
      placeholder="종목명 또는 6자리 코드 (예: 삼성전자, 005930)"
    />
  );
}
