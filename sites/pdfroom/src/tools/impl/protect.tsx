"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import { baseName, fileBytes, formatBytes, pdfBlob, runQpdf } from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, ResultBox, inputCls } from "@/tools/ui";

export default function Protect() {
  const [file, setFile] = useState<File | null>(null);
  const [userPw, setUserPw] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(false);
  const [allowModify, setAllowModify] = useState(false);
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
    if (!userPw) {
      setError("문서를 열 때 쓸 비밀번호를 입력해 주세요.");
      return;
    }
    if (userPw.length < 4) {
      setError("비밀번호는 4자 이상으로 정해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const bytes = await fileBytes(file);
      const owner = ownerPw || userPw;
      const args = [
        "/in.pdf",
        "--encrypt",
        `--user-password=${userPw}`,
        `--owner-password=${owner}`,
        "--bits=256",
        `--print=${allowPrint ? "full" : "none"}`,
        `--extract=${allowCopy ? "y" : "n"}`,
        `--modify=${allowModify ? "all" : "none"}`,
        "--",
        "/out.pdf",
      ];
      const run1 = await runQpdf([{ path: "/in.pdf", bytes }], args, "/out.pdf");
      if (!run1.output) {
        throw new Error(
          run1.stderr.trim() ||
            "암호화에 실패했습니다. 이미 비밀번호가 걸린 PDF 라면 먼저 잠금을 해제해 주세요.",
        );
      }
      setResult(pdfBlob(run1.output));
    } catch (e) {
      setError((e as Error)?.message ?? "암호화 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple={false}
        maxSizeMB={150}
        onFiles={onFiles}
        hint="비밀번호를 걸 PDF 1개를 선택하세요"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="열기 비밀번호 (사용자 비밀번호)"
          htmlFor="pp-user"
          hint="이 비밀번호가 있어야 문서를 열 수 있습니다"
        >
          <input
            id="pp-user"
            type="password"
            value={userPw}
            onChange={(e) => {
              setUserPw(e.target.value);
              setResult(null);
            }}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
        <Field
          label="권한 비밀번호 (소유자 비밀번호, 선택)"
          htmlFor="pp-owner"
          hint="비우면 열기 비밀번호와 같게 설정됩니다"
        >
          <input
            id="pp-owner"
            type="password"
            value={ownerPw}
            onChange={(e) => {
              setOwnerPw(e.target.value);
              setResult(null);
            }}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">허용할 작업</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={allowPrint}
            onChange={(e) => setAllowPrint(e.target.checked)}
          />
          인쇄 허용
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={allowCopy}
            onChange={(e) => setAllowCopy(e.target.checked)}
          />
          텍스트·이미지 복사 허용
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={allowModify}
            onChange={(e) => setAllowModify(e.target.checked)}
          />
          내용 수정 허용
        </label>
      </fieldset>

      <Btn onClick={run} disabled={busy || !file}>
        {busy ? "암호화 중…" : "비밀번호 설정하기"}
      </Btn>

      {busy && <Progress value={60} label="AES-256 으로 암호화하는 중" />}
      <ErrorBox>{error}</ErrorBox>

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">완료 — {formatBytes(result.size)}</p>
          <p className="text-xs text-slate-600">
            내려받은 파일을 열 때 비밀번호를 묻는지 꼭 확인하세요. 비밀번호는 이 페이지 어디에도
            저장되지 않으므로 잊어버리면 <b>복구할 수 없습니다.</b>
          </p>
          <Btn onClick={() => saveBlob(result, `${baseName(file?.name ?? "pdf")}_보호.pdf`)}>
            다운로드
          </Btn>
        </ResultBox>
      )}

      <Notice title="어떻게 브라우저에서 암호화가 되나요?">
        오픈소스 PDF 도구인 <b>qpdf</b> 를 WebAssembly 로 컴파일한 모듈을 내려받아 브라우저 안에서
        실행합니다. 파일과 비밀번호는 가상 파일 시스템(메모리) 안에서만 오가며 서버로 나가지
        않습니다. 암호화 방식은 PDF 2.0 이 채택한 <b>AES-256</b> 입니다.
      </Notice>

      <Notice tone="warn">
        &ldquo;복사 금지&rdquo;·&ldquo;인쇄 금지&rdquo; 같은 권한 설정은 뷰어가 자발적으로 지키는
        약속일 뿐 강제력이 없습니다. 실제로 내용을 보호하는 것은 <b>열기 비밀번호</b>뿐입니다.
      </Notice>
    </div>
  );
}
