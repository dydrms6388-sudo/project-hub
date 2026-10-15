import type { Metadata } from "next";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: `${site.name}의 개인정보처리방침입니다.`,
  alternates: { canonical: "/privacy/" },
  robots: { index: false, follow: true },
};

export default function Privacy() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-slate-500">최종 개정일: 2026년 8월 19일</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">1. 수집하는 개인정보 항목</h2>
          <p>
            {site.name}(이하 &ldquo;사이트&rdquo;)는 회원가입 절차가 없으며, 이용자의 이름·연락처·이메일·
            주민등록번호 등 <strong>개인을 식별할 수 있는 정보를 일절 수집하지 않습니다.</strong>
          </p>
          <p className="mt-2">
            이용자가 사이트의 도구에 입력하거나 업로드한 텍스트·파일은 이용자의 브라우저(기기) 안에서만
            처리되며, 사이트 운영자의 서버로 전송되거나 저장되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">2. 브라우저 저장소(localStorage) 이용</h2>
          <p>
            일부 도구는 이용자 편의를 위해 마지막 입력값이나 설정을 이용자 기기의 브라우저 저장소에
            보관합니다. 이 데이터는 <strong>이용자의 기기에만 저장</strong>되며 외부로 전송되지 않고,
            브라우저의 &lsquo;사이트 데이터 삭제&rsquo; 기능이나 각 도구의 초기화 버튼으로 언제든지 삭제할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">3. 쿠키 및 광고·분석 도구</h2>
          <p>
            사이트는 서비스 운영을 위해 다음의 제3자 서비스를 이용할 수 있으며, 이 과정에서 쿠키 또는
            유사 기술이 사용될 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Google AdSense</strong> — 광고 게재. Google을 포함한 제3자 공급업체는 쿠키를 사용해
              이용자의 이전 방문 기록에 기반한 광고를 게재할 수 있습니다. 이용자는{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-blue-600 hover:underline"
              >
                Google 광고 설정
              </a>
              에서 맞춤 광고를 해제할 수 있습니다.
            </li>
            <li>
              <strong>Vercel Analytics</strong> — 방문 통계 집계. 개인을 식별하지 않는 형태의 집계 데이터만
              수집합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">4. 개인정보의 제3자 제공 및 보유 기간</h2>
          <p>
            사이트는 개인정보를 수집하지 않으므로 제3자에게 제공하거나 위탁하는 개인정보가 없으며,
            별도로 보유·파기하는 개인정보 또한 없습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">5. 아동의 개인정보</h2>
          <p>
            사이트는 만 14세 미만 아동의 개인정보를 고의로 수집하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-900">6. 문의처</h2>
          <p>
            개인정보 처리에 관한 문의는{" "}
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
