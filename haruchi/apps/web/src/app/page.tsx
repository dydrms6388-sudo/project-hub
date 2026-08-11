import Link from 'next/link';

/**
 * 대시보드.
 *
 * Phase 1 시점에는 예산 엔진이 없다. "오늘 쓸 수 있는 돈"을 계산할 근거가 없으므로
 * 그럴듯한 숫자를 만들어 보여주지 않는다 (스펙 14장: 틀릴 수 있는 숫자를 확신에 찬
 * 톤으로 표시하지 않는다). 대신 다음에 할 일을 제시한다.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">시작하기</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          문자 하나 붙여넣어 볼까요?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          카드 승인 문자를 그대로 붙여넣으면 날짜·금액·가맹점을 알아서 정리합니다. 같은 결제가
          두 번 들어와도 한 건으로 묶고요. 로그인 없이 먼저 확인해 볼 수 있어요.
        </p>
        <Link
          href="/paste"
          className="mt-5 inline-block rounded-md bg-safe px-4 py-2 text-sm font-medium text-white"
        >
          붙여넣기
        </Link>
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-medium">하루치가 하지 않는 것</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>카드사·은행에 대신 접속하지 않습니다.</li>
          <li>아이디·비밀번호·공동인증서를 묻지 않습니다.</li>
          <li>카드번호는 뒤 4자리만 다루고, 전체 번호는 저장하지 않습니다.</li>
          <li>문자 원문은 브라우저에서 읽고, 등록한 거래만 저장합니다.</li>
        </ul>
      </section>
    </div>
  );
}
