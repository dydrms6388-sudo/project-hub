// 조치 결과 플래시 배너 — Server Action 이 redirect 쿼리(?e= / ?m=)로 전달한다.
// (전역 ToastProvider 설치는 E그룹 앱 셸 소관 — 어드민은 서버 렌더 배너로 대체)

export function Flash({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  if (error) {
    return (
      <div
        role="alert"
        className="mb-4 rounded-md border border-line bg-danger-tint px-4 py-3 text-body-sm text-danger"
      >
        처리 실패: {error}
      </div>
    );
  }
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-line bg-success-tint px-4 py-3 text-body-sm text-success"
    >
      {message}
    </div>
  );
}

/** searchParams 에서 플래시 문자열 추출 */
export function flashFrom(sp: Record<string, string | string[] | undefined>): {
  error?: string;
  message?: string;
} {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { error: one(sp.e), message: one(sp.m) };
}
