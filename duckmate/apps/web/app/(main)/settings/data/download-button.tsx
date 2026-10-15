"use client";

// =============================================================================
// E4 · 내 데이터 내려받기 버튼 (client) — 서버가 만든 JSON 을 브라우저가 파일로 저장
// =============================================================================

import * as React from "react";
import { Button } from "@duckmate/ui";
import { exportMyData } from "./actions";

export function DownloadButton() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const run = async () => {
    setPending(true);
    setError(null);
    setDone(false);
    const result = await exportMyData();
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    const blob = new Blob([result.json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setPending(false);
    setDone(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" loading={pending} onClick={() => void run()}>
        내 데이터 내려받기 (JSON)
      </Button>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-body-sm text-success">
          파일을 내려받았어요.
        </p>
      )}
    </div>
  );
}
