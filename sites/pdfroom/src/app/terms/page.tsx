import type { Metadata } from "next";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "이용약관",
  description: `${site.name}의 이용약관입니다.`,
  alternates: { canonical: "/terms/" },
  robots: { index: false, follow: true },
};

export default function Terms() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">이용약관</h1>
      <p className="mt-2 text-sm text-slate-500">시행일: 2026년 8월 19일</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">제1조 (목적)</h2>
          <p>
            본 약관은 {site.name}(이하 &ldquo;사이트&rdquo;)가 제공하는 웹 기반 도구 서비스의 이용 조건과
            운영자·이용자의 권리와 의무를 정하는 것을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">제2조 (서비스의 성격)</h2>
          <p>
            사이트가 제공하는 모든 도구는 이용자의 브라우저에서 실행되는 클라이언트 사이드 프로그램입니다.
            별도의 회원가입이 없으며, 서비스는 무료로 제공됩니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">제3조 (이용자의 의무)</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>이용자는 관련 법령을 위반하는 목적으로 서비스를 이용해서는 안 됩니다.</li>
            <li>이용자는 타인의 저작권 등 권리를 침해하는 파일의 처리에 서비스를 이용해서는 안 됩니다.</li>
            <li>자동화된 수단으로 서비스에 과도한 부하를 유발하는 행위를 해서는 안 됩니다.</li>
            <li>
              [PDF 비밀번호 해제] 도구는 <strong>이용자 본인에게 정당한 권한이 있고 비밀번호를 이미 알고
              있는 문서</strong>에만 사용해야 합니다. 타인의 저작물·기밀문서에 적용된 기술적 보호조치를
              권한 없이 무력화하는 행위는 저작권법 및 정보통신망법 위반이 될 수 있으며, 그 책임은 이용자
              본인에게 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">제4조 (결과의 정확성과 면책)</h2>
          <p>
            사이트가 제공하는 계산·변환·분석 결과는 <strong>참고용</strong>이며, 정확성·완전성을 보장하지
            않습니다. 특히 세무·법률·의료·금융과 관련된 결과는 확정적인 판단이나 전문가의 자문을 대체하지
            않습니다. 이용자가 결과를 신뢰하여 내린 판단과 그로 인한 손해에 대하여 운영자는 책임을 지지
            않습니다.
          </p>
          <p className="mt-2">
            또한 이용자의 브라우저·기기 환경, 파일 형식, 용량 등에 따라 처리가 실패할 수 있으며, 이로 인한
            데이터 손실에 대비해 <strong>원본 파일을 반드시 별도로 보관</strong>하시기 바랍니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">제5조 (서비스의 변경·중단)</h2>
          <p>
            운영자는 서비스의 내용을 변경하거나 제공을 중단할 수 있으며, 이 경우 사전 고지를 위해 노력합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">제6조 (오픈소스 고지)</h2>
          <p>
            사이트는 다음의 오픈소스 소프트웨어를 이용자의 브라우저에서 실행합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>pdf-lib · @pdf-lib/fontkit — MIT License</li>
            <li>Mozilla pdf.js — Apache License 2.0</li>
            <li>qpdf (WebAssembly 빌드) — Apache License 2.0</li>
            <li>JSZip — MIT / GPLv3 듀얼 라이선스</li>
            <li>
              Pretendard (한글 서브셋 임베딩용) — SIL Open Font License 1.1 (
              <a href="/fonts/Pretendard-OFL-LICENSE.txt" className="text-blue-600 hover:underline">
                라이선스 전문
              </a>
              )
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">제7조 (문의)</h2>
          <p>
            약관에 관한 문의는{" "}
            <a href={`mailto:${site.email}`} className="text-blue-600 hover:underline">
              {site.email}
            </a>{" "}
            로 보내주시기 바랍니다.
          </p>
        </section>
      </div>
    </div>
  );
}
