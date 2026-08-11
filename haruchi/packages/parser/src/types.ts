import type { ForeignOrigin, TransactionKind, TransactionSource } from '@haruchi/schema';

export interface ParseContext {
  /** "지금"(UTC). 연도 없는 날짜 추정에 쓴다. 절대 내부에서 시계를 읽지 않는다. */
  now: Date;
  source: TransactionSource;
}

/**
 * 어댑터가 뽑아낸 거래 초안. dedupe_key 와 상호명 정규화는 코어가 붙인다.
 * 어댑터는 "문자에서 읽어낸 것"만 책임진다.
 */
export interface TransactionDraft {
  occurredAt: string;
  hasTime: boolean;
  amount: number;
  kind: TransactionKind;
  isCancellation: boolean;
  merchantRaw: string;
  accountLast4: string | null;
  issuer: string | null;
  installmentMonths: number | null;
  isPending: boolean;
  foreign?: ForeignOrigin;
}

/**
 * 카드사/은행 1곳 = 파일 1개.
 * 새 발신처를 추가할 때 건드릴 파일은 어댑터 1개 + 픽스처 1개뿐이어야 한다
 * (스펙 10장 유지보수 감사관).
 */
export interface Adapter {
  /** 안정적인 식별자. rawPayload 와 실패율 리포트에 그대로 쓰인다. */
  id: string;
  /** 표시용 발신처 이름. 연동을 의미하지 않는다. */
  issuer: string;
  /** 낮을수록 먼저 시도한다. 여러 어댑터가 detect 하면 이 순서로 결정된다. */
  priority: number;
  detect(body: string): boolean;
  /** 읽어내지 못하면 null 을 반환한다. 빈 배열이 아니라 null 이어야 한다. */
  parse(body: string, ctx: ParseContext): TransactionDraft[] | null;
}
