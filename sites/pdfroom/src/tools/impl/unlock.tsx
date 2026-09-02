"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import { baseName, fileBytes, formatBytes, pdfBlob, runQpdf } from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, ResultBox, inputCls } from "@/tools/ui";

export default function Unlock() {
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Blob | null>(null);

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
    setError("");
  }, []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const bytes = await fileBytes(file);
      const args = [`--password=${pw}`, "--decrypt", "/in.pdf", "/out.pdf"];
      const r = await runQpdf([{ path: "/in.pdf", bytes }], args, "/out.pdf");
      if (!r.output) {
        const msg = r.stderr.toLowerCase();
        if (msg.includes("invalid password")) {
          throw new Error(
            "비밀번호가 맞지 않습니다. 대소문자와 공백을 확인해 주세요. (비밀번호를 모르는 문서는 이 도구로 열 수 없습니다)",
          );
        }
        throw new Error(
          r.stderr.trim() || "잠금 해제에 실패했습니다. 손상된 파일이거나 지원하지 않는 형식입니다.",
        );
      }
      setResult(pdfBlob(r.output));
    } catch (e) {
      setError((e as Error)?.message ?? "잠금 해제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Notice tone="warn" title="법적 고지 — 본인 문서에만 사용하세요">
        이 도구는 <b>비밀번호를 이미 알고 있는, 본인에게 권한이 있는 문서</b>의 잠금을 푸는
        용도입니다. 비밀번호를 추측하거나 깨뜨리는 기능은 없습니다. 타인의 저작물·기밀문서의 보호
        조치를 권한 없이 무력화하는 행위는 저작권법(기술적 보호조치 무력화 금지) 및 정보통신망법
        위반이 될 수 있으며, 그 책임은 이용자 본인에게 있습니다.
      </Notice>

      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple={false}
        maxSizeMB={150}
        onFiles={onFiles}
        hint="잠금을 해제할 PDF 1개를 선택하세요"
      />

      <Field
        label="현재 비밀번호"
        htmlFor="ul-pw"
        hint="열기 비밀번호가 없고 권한(소유자) 비밀번호만 걸린 문서라면 비워 두어도 됩니다"
      >
        <input
          id="ul-pw"
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setResult(null);
          }}
          autoComplete="off"
          className={inputCls}
        />
      </Field>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1"
        />
        이 문서를 잠금 해제할 정당한 권한이 나에게 있음을 확인합니다.
      </label>

      <Btn onClick={run} disabled={busy || !file || !agree}>
        {busy ? "해제 중…" : "잠금 해제하기"}
      </Btn>

      {busy && <Progress value={60} label="복호화하는 중" />}
      <ErrorBox>{error}</ErrorBox>

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">완료 — {formatBytes(result.size)}</p>
          <p className="text-xs text-slate-600">
            비밀번호 없이 열리는 PDF 가 만들어졌습니다. 원본과 마찬가지로 다루어 주세요.
          </p>
          <Btn onClick={() => saveBlob(result, `${baseName(file?.name ?? "pdf")}_해제.pdf`)}>
            다운로드
          </Btn>
        </ResultBox>
      )}

      <Notice title="두 종류의 비밀번호">
        PDF 에는 <b>열기(user) 비밀번호</b>와 <b>권한(owner) 비밀번호</b> 두 가지가 있습니다. 앞의
        것은 문서를 여는 데 필요하고, 뒤의 것은 인쇄·복사 같은 권한을 잠급니다. 열기 비밀번호가 없이
        권한만 잠긴 문서는 비밀번호 칸을 비워 둔 채로도 해제됩니다. 처리는 qpdf 를 WebAssembly 로
        컴파일한 모듈이 브라우저 안에서 수행하며, 파일과 비밀번호는 서버로 전송되지 않습니다.
      </Notice>
    </div>
  );
}
