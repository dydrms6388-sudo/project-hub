// 토스페이먼츠 서버 API 헬퍼.
// 인증: "Basic base64(SECRET_KEY + ':')" 헤더. (시크릿 뒤에 콜론, 비밀번호 없음)
// 결제 승인: POST https://api.tosspayments.com/v1/payments/confirm

const TOSS_API_BASE = "https://api.tosspayments.com";

function authHeader(): string {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error("TOSS_SECRET_KEY is not set");
  // Node 런타임: Buffer 사용. (이 헬퍼는 nodejs runtime 라우트에서만 호출)
  const token = Buffer.from(`${secret}:`).toString("base64");
  return `Basic ${token}`;
}

export interface TossConfirmResult {
  paymentKey: string;
  orderId: string;
  status: string; // DONE | CANCELED | ...
  totalAmount: number;
  method?: string;
  approvedAt?: string;
}

/**
 * 토스 결제 승인. 클라이언트 결제위젯이 성공 콜백으로 넘긴
 * (paymentKey, orderId, amount) 를 서버에서 최종 승인한다.
 * 반드시 서버가 보관한 주문 금액과 amount 가 일치하는지 호출 전에 검증할 것.
 */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResult> {
  const res = await fetch(`${TOSS_API_BASE}/v1/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      // 멱등키: 동일 결제 중복 승인 방지
      "Idempotency-Key": params.orderId,
    },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as TossConfirmResult & {
    code?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(
      `Toss confirm failed: ${data.code ?? res.status} ${data.message ?? ""}`
    );
  }
  return data;
}
