"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <div style={{ paddingTop: 32 }}>
      <h1>문제가 발생했습니다</h1>
      <p className="sub">
        잠시 후 다시 시도해주세요. 계속 같은 화면이 나오면 꾸꾸에게 알려주세요.
      </p>
      {error.digest && <p className="meta">오류 코드: {error.digest}</p>}
      <button className="btn btn-block" onClick={reset}>
        다시 시도
      </button>
    </div>
  );
}
