import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/lib/seo";
import { site } from "@/site.config";
import { MODELS } from "@/lib/docmind/models";
import WebGpuCheck from "./WebGpuCheck";

export const metadata: Metadata = {
  title: "지원 브라우저 안내 (WebGPU 확인)",
  description:
    "독마인드의 문서 요약 도구는 WebGPU 가 필요합니다. 브라우저·PC 요구사항과 내 브라우저 지원 여부를 확인하세요.",
  alternates: { canonical: "/browser-support/" },
};

const BROWSERS: { name: string; support: string; note: string; ok: boolean }[] = [
  {
    name: "크롬 (Windows / macOS / Linux)",
    support: "113 버전 이상",
    note: "가장 권장. Linux 는 일부 배포판에서 플래그가 필요할 수 있습니다.",
    ok: true,
  },
  {
    name: "엣지 (Windows / macOS)",
    support: "113 버전 이상",
    note: "크롬과 같은 엔진이라 동작이 동일합니다.",
    ok: true,
  },
  {
    name: "사파리 (macOS / iPadOS)",
    support: "Safari 26 이상",
    note: "그 이전 버전은 설정 › 기능 실험에서 WebGPU 를 켜야 합니다. 메모리 제한이 커 실패할 수 있습니다.",
    ok: true,
  },
  {
    name: "파이어폭스",
    support: "Windows 141 이상",
    note: "macOS·Linux 판은 순차 적용 중입니다. 지원되지 않으면 about:config 에서 dom.webgpu.enabled 를 켜 시도할 수 있습니다.",
    ok: true,
  },
  {
    name: "모바일 브라우저 (안드로이드 / iOS)",
    support: "권장하지 않음",
    note: "WebGPU 를 지원하더라도 1GB 모델을 올릴 메모리가 부족해 대부분 실패합니다.",
    ok: false,
  },
  {
    name: "인앱 브라우저 (카카오톡·인스타그램 등)",
    support: "지원 안 함",
    note: "‘다른 브라우저로 열기’로 크롬·엣지에서 다시 열어 주세요.",
    ok: false,
  },
];

export default function BrowserSupport() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${site.url}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: "지원 브라우저 안내",
          item: `${site.url}/browser-support/`,
        },
      ],
    },
  ];

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <JsonLd data={jsonLd} />
      <nav aria-label="경로" className="mb-3 text-xs text-slate-500">
        <Link href="/" className="hover:underline">
          홈
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-700">지원 브라우저 안내</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        지원 브라우저 안내
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        독마인드는 문서를 서버로 보내지 않습니다. 대신 AI 모델을 여러분의 브라우저로 내려받아
        그래픽카드에서 직접 돌립니다. 그래서 <b>WebGPU</b> 라는 최신 웹 표준이 반드시 필요합니다.
      </p>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-slate-900">내 브라우저 확인</h2>
        <WebGpuCheck />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-slate-900">브라우저별 지원 현황</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th scope="col" className="p-3 font-semibold">
                  브라우저
                </th>
                <th scope="col" className="p-3 font-semibold">
                  필요 버전
                </th>
                <th scope="col" className="p-3 font-semibold">
                  비고
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {BROWSERS.map((b) => (
                <tr key={b.name} className={b.ok ? "" : "bg-red-50/40"}>
                  <th scope="row" className="p-3 text-left font-medium text-slate-800">
                    {b.name}
                  </th>
                  <td className="p-3 text-slate-700">{b.support}</td>
                  <td className="p-3 leading-relaxed text-slate-600">{b.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          버전 기준은 각 브라우저 벤더 공지와 Can I use 의 WebGPU 항목을 따릅니다. 브라우저 업데이트
          상황에 따라 달라질 수 있으니 위의 실시간 확인 결과를 우선하세요.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-slate-900">하드웨어 요구사항</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th scope="col" className="p-3 font-semibold">
                  항목
                </th>
                <th scope="col" className="p-3 font-semibold">
                  최소
                </th>
                <th scope="col" className="p-3 font-semibold">
                  권장
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <th scope="row" className="p-3 text-left font-medium text-slate-800">
                  GPU 메모리(VRAM)
                </th>
                <td className="p-3 text-slate-700">약 1GB (0.5B 모델)</td>
                <td className="p-3 text-slate-700">2.5GB 이상 (1.5B~3B 모델)</td>
              </tr>
              <tr>
                <th scope="row" className="p-3 text-left font-medium text-slate-800">
                  시스템 메모리
                </th>
                <td className="p-3 text-slate-700">8GB</td>
                <td className="p-3 text-slate-700">16GB 이상</td>
              </tr>
              <tr>
                <th scope="row" className="p-3 text-left font-medium text-slate-800">
                  GPU 종류
                </th>
                <td className="p-3 text-slate-700">최근 5년 내 내장 그래픽</td>
                <td className="p-3 text-slate-700">외장 GPU 또는 애플 실리콘</td>
              </tr>
              <tr>
                <th scope="row" className="p-3 text-left font-medium text-slate-800">
                  최초 다운로드
                </th>
                <td className="p-3 text-slate-700">약 0.9GB</td>
                <td className="p-3 text-slate-700">약 1.6~2.5GB (큰 모델)</td>
              </tr>
              <tr>
                <th scope="row" className="p-3 text-left font-medium text-slate-800">
                  저장 공간
                </th>
                <td className="p-3 text-slate-700">브라우저 캐시 2GB 여유</td>
                <td className="p-3 text-slate-700">4GB 이상 여유</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          다운로드 용량은 모델 가중치 크기에 해당하며, 아래 모델별 VRAM 요구량과 거의 같습니다.
          요약에 걸리는 실제 시간은 GPU 성능에 따라 크게 달라집니다 — 이 사이트는 특정 기기에서의
          소요 시간을 측정해 공개하지 않습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-slate-900">모델별 요구 사양</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th scope="col" className="p-3 font-semibold">
                  모델
                </th>
                <th scope="col" className="p-3 font-semibold">
                  파라미터
                </th>
                <th scope="col" className="p-3 font-semibold">
                  필요 VRAM
                </th>
                <th scope="col" className="p-3 font-semibold">
                  문맥
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {MODELS.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="p-3 text-left font-medium text-slate-800">
                    {m.label}
                    {m.requiredFeatures?.length ? (
                      <span className="block text-xs font-normal text-slate-500">
                        {m.requiredFeatures.join(", ")} 확장 필요
                      </span>
                    ) : null}
                  </th>
                  <td className="p-3 text-slate-700">{m.params}</td>
                  <td className="p-3 text-slate-700">{Math.round(m.vramMB).toLocaleString()}MB</td>
                  <td className="p-3 text-slate-700">
                    {m.contextWindow.toLocaleString()}
                    토큰
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          수치 출처: 설치된 @mlc-ai/web-llm 패키지의 모델 목록(prebuiltAppConfig).
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-slate-900">WebGPU 가 없으면 왜 못 쓰나요?</h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
          <p>
            언어 모델은 초당 수십억 번의 행렬 곱셈을 합니다. GPU 는 이 연산을 병렬로 처리하도록
            만들어진 장치이고, WebGPU 는 웹페이지가 그 GPU 에 접근할 수 있게 해 주는 표준
            인터페이스입니다.
          </p>
          <p>
            WebGPU 없이 CPU(WebAssembly)로도 같은 계산을 할 수는 있습니다. 다만 병렬성이 수십 배
            낮아 한 문단을 요약하는 데에도 수십 분이 걸립니다. 기다림 끝에 실패하는 경험을 주는 대신,
            독마인드는 WebGPU 가 없는 브라우저에서 도구를 아예 비활성화합니다.
          </p>
          <p>
            대안이 필요하다면, 문서를 직접 붙여 넣어 쓰는 온라인 AI 서비스를 쓰거나, PC 에 설치형
            로컬 LLM(예: Ollama, LM Studio)을 두고 사용하는 방법이 있습니다. 어느 쪽이든 문서가
            어디로 전송되는지 먼저 확인하세요.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-slate-900">참고 링크</h2>
        <ul className="space-y-1 text-sm">
          {[
            { label: "MDN — WebGPU API", url: "https://developer.mozilla.org/ko/docs/Web/API/WebGPU_API" },
            { label: "Can I use — WebGPU 지원 현황", url: "https://caniuse.com/webgpu" },
            { label: "MLC WebLLM", url: "https://github.com/mlc-ai/web-llm" },
          ].map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-blue-600 hover:underline"
              >
                {s.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8">
        <Link href="/tools/" className="text-blue-700 hover:underline">
          ← 전체 도구 보기
        </Link>
      </p>
    </article>
  );
}
