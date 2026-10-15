"use client";

// =============================================================================
// E1 · 가입 폼 — signUpWithAge (D2 §2 시그니처: email/password/nickname/
//      birthDate(YYYY-MM-DD)/gender(m|f|n)/regionCode)
//
// 규칙
// - 약관 동의: 필수/선택 분리, 사전 체크 금지(다크패턴), 법적 문서는 /legal/{slug}.
// - 만 19세 미만: 즉시 차단 화면 + "입력값을 저장하지 않았어요" 고지, 같은 세션에서
//   폼 재노출 금지 (12_flows §2.1 · A5 §1.3-1).
// - 에러는 ActionResult.code → 한국어 매핑(action-errors.ts).
// =============================================================================

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Select } from "@duckmate/ui";
import type { Gender } from "@duckmate/db";
import { signUpWithAge } from "@/lib/auth/actions";
import { isAdultBirthDate } from "@/lib/auth/schemas";
import { messageForActionError } from "@/app/onboarding/_lib/action-errors";

const REGIONS: readonly { code: string; label: string }[] = [
  { code: "seoul", label: "서울" },
  { code: "gyeonggi", label: "경기" },
  { code: "incheon", label: "인천" },
  { code: "busan", label: "부산" },
  { code: "daegu", label: "대구" },
  { code: "daejeon", label: "대전" },
  { code: "gwangju", label: "광주" },
  { code: "ulsan", label: "울산" },
  { code: "sejong", label: "세종" },
  { code: "gangwon", label: "강원" },
  { code: "chungbuk", label: "충북" },
  { code: "chungnam", label: "충남" },
  { code: "jeonbuk", label: "전북" },
  { code: "jeonnam", label: "전남" },
  { code: "gyeongbuk", label: "경북" },
  { code: "gyeongnam", label: "경남" },
  { code: "jeju", label: "제주" },
] as const;

const GENDERS: readonly { value: Gender; label: string }[] = [
  { value: "f", label: "여성" },
  { value: "m", label: "남성" },
  { value: "n", label: "밝히지 않을래요" },
] as const;

/** 필수 = 서비스 제공에 반드시 필요한 동의, 선택 = 거부해도 가입 가능 */
const REQUIRED_CONSENTS = [
  { key: "terms", label: "이용약관 동의", slug: "terms" },
  { key: "privacy", label: "개인정보 처리방침 동의", slug: "privacy" },
  { key: "community", label: "커뮤니티 가이드라인 동의", slug: "community" },
] as const;

const OPTIONAL_CONSENTS = [
  { key: "location", label: "위치기반서비스 이용약관 동의 (선택)", slug: "location" },
  { key: "marketing", label: "혜택·소식 알림 받기 (선택)", slug: null },
] as const;

type ConsentKey =
  | (typeof REQUIRED_CONSENTS)[number]["key"]
  | (typeof OPTIONAL_CONSENTS)[number]["key"];

function pad2(v: string) {
  return v.padStart(2, "0");
}

export function SignupForm({ initialBirthDate }: { initialBirthDate?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [year, setYear] = useState(initialBirthDate?.slice(0, 4) ?? "");
  const [month, setMonth] = useState(initialBirthDate?.slice(5, 7) ?? "");
  const [day, setDay] = useState(initialBirthDate?.slice(8, 10) ?? "");
  const [gender, setGender] = useState<Gender | "">("");
  const [regionCode, setRegionCode] = useState("");
  const [consent, setConsent] = useState<Record<ConsentKey, boolean>>({
    terms: false,
    privacy: false,
    community: false,
    location: false,
    marketing: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  // @duckmate/ui 의 Input 은 ref 를 노출하지 않으므로(포워딩 없음) id 로 포커스를 옮긴다
  function focusById(id: string) {
    document.getElementById(id)?.focus();
  }

  useEffect(() => {
    // 퍼널 이벤트 signup_start (A3 §4.1 이름 그대로) — 수집 어댑터는 E6 소관
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("duckmate:analytics", { detail: { event: "signup_start" } }));
    }
  }, []);

  const birthDate = useMemo(
    () => (year.length === 4 && month && day ? `${year}-${pad2(month)}-${pad2(day)}` : ""),
    [year, month, day]
  );

  const requiredOk = REQUIRED_CONSENTS.every((c) => consent[c.key]);
  const allConsentChecked =
    requiredOk && OPTIONAL_CONSENTS.every((c) => consent[c.key]);
  const formOk =
    email.trim() !== "" &&
    password.length >= 8 &&
    nickname.trim().length >= 2 &&
    birthDate !== "" &&
    gender !== "" &&
    regionCode !== "" &&
    requiredOk;

  function toggleAll(checked: boolean) {
    setConsent({
      terms: checked,
      privacy: checked,
      community: checked,
      location: checked,
      marketing: checked,
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!requiredOk) {
      setError("필수 항목에 동의해야 가입할 수 있어요.");
      return;
    }
    // 게이트 1/3 (클라이언트) — 서버·DB 트리거가 나머지 두 겹을 담당한다
    if (!isAdultBirthDate(birthDate)) {
      setDenied(true);
      return;
    }

    startTransition(async () => {
      const res = await signUpWithAge({
        email: email.trim(),
        password,
        nickname: nickname.trim(),
        birthDate,
        gender: gender as Gender,
        regionCode,
      });

      if (!res.ok) {
        if (res.code === "UNDERAGE") {
          setDenied(true);
          return;
        }
        setError(messageForActionError(res.code, res.message));
        return;
      }

      // signUpWithAge 가 onboarding_step 을 phone 으로 전진시킨다 (D2-7).
      // 이메일 확인이 켜져 있어 세션이 없으면 미들웨어가 /login 으로 돌려보낸다.
      router.replace("/onboarding/phone");
      router.refresh();
    });
  }

  if (denied) {
    // 재시도 폼 재노출 금지 (같은 세션) — 12_flows §2.1
    return (
      <Card className="mt-6" role="alert" data-testid="age-denied">
        <h2 className="text-h2">만 19세 이상부터 이용할 수 있어요</h2>
        <p className="mt-2 text-body-sm text-ink-muted">
          입력하신 내용은 저장하지 않았어요. 성인이 된 뒤에 다시 찾아와 주세요.
        </p>
        <div className="mt-4">
          <Button size="lg" onClick={() => router.replace("/")} data-testid="age-denied-confirm">
            확인
          </Button>
        </div>
      </Card>
    );
  }

  const invalid = error !== null;

  return (
    <form className="mt-6 flex flex-col gap-5" onSubmit={onSubmit} noValidate data-testid="signup-form">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-email" className="text-body-sm font-semibold">
          이메일
        </label>
        <Input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="signup-email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-password" className="text-body-sm font-semibold">
          비밀번호
        </label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          aria-describedby="signup-password-help"
          onChange={(e) => setPassword(e.target.value)}
          data-testid="signup-password"
        />
        <p id="signup-password-help" className="text-caption text-ink-muted">
          8자 이상으로 만들어 주세요.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-nickname" className="text-body-sm font-semibold">
          닉네임
        </label>
        <Input
          id="signup-nickname"
          required
          maxLength={12}
          value={nickname}
          aria-describedby="signup-nickname-help"
          onChange={(e) => setNickname(e.target.value)}
          data-testid="signup-nickname"
        />
        <p id="signup-nickname-help" className="text-caption text-ink-muted">
          2~12자. 실명 대신 부르고 싶은 이름으로 적어 주세요.
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-body-sm font-semibold">생년월일</legend>
        <div className="flex items-center gap-2" data-testid="signup-birth">
          <Input
            id="signup-birth-year"
            aria-label="출생 연도 4자리"
            inputMode="numeric"
            maxLength={4}
            placeholder="1999"
            className="w-24"
            value={year}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setYear(v);
              if (v.length === 4) focusById("signup-birth-month");
            }}
            data-testid="signup-birth-year"
          />
          <span aria-hidden="true" className="text-ink-muted">
            /
          </span>
          <Input
            id="signup-birth-month"
            aria-label="출생 월"
            inputMode="numeric"
            maxLength={2}
            placeholder="03"
            className="w-16"
            value={month}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
              setMonth(v);
              if (v.length === 2) focusById("signup-birth-day");
            }}
            data-testid="signup-birth-month"
          />
          <span aria-hidden="true" className="text-ink-muted">
            /
          </span>
          <Input
            id="signup-birth-day"
            aria-label="출생 일"
            inputMode="numeric"
            maxLength={2}
            placeholder="21"
            className="w-16"
            value={day}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
            data-testid="signup-birth-day"
          />
        </div>
        <p className="text-caption text-ink-muted">
          본인인증 시 실제 생년월일과 대조해요. 다르면 이용이 제한될 수 있어요.
        </p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-gender" className="text-body-sm font-semibold">
          성별
        </label>
        <Select
          id="signup-gender"
          required
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender)}
          data-testid="signup-gender"
        >
          <option value="">선택해 주세요</option>
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-region" className="text-body-sm font-semibold">
          주로 활동하는 지역
        </label>
        <Select
          id="signup-region"
          required
          value={regionCode}
          onChange={(e) => setRegionCode(e.target.value)}
          data-testid="signup-region"
        >
          <option value="">선택해 주세요</option>
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-4">
        <legend className="px-1 text-body-sm font-semibold">약관 동의</legend>

        <label className="flex items-center gap-3 text-body-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={allConsentChecked}
            onChange={(e) => toggleAll(e.target.checked)}
            data-testid="consent-all"
          />
          전체 동의 (선택 항목 포함)
        </label>
        <hr className="my-1 border-line" />

        {REQUIRED_CONSENTS.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-3 text-body-sm">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={consent[c.key]}
                onChange={(e) => setConsent((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                data-testid={`consent-${c.key}`}
              />
              <span>
                <span className="text-accent-text">[필수]</span> {c.label}
              </span>
            </label>
            <Link
              href={`/legal/${c.slug}`}
              className="shrink-0 text-caption text-ink-muted underline underline-offset-4"
            >
              보기
            </Link>
          </div>
        ))}

        {OPTIONAL_CONSENTS.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-3 text-body-sm">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={consent[c.key]}
                onChange={(e) => setConsent((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                data-testid={`consent-${c.key}`}
              />
              <span>{c.label}</span>
            </label>
            {c.slug ? (
              <Link
                href={`/legal/${c.slug}`}
                className="shrink-0 text-caption text-ink-muted underline underline-offset-4"
              >
                보기
              </Link>
            ) : null}
          </div>
        ))}

        <p className="mt-1 text-caption text-ink-muted">
          선택 항목에 동의하지 않아도 가입하고 이용할 수 있어요.{" "}
          <Link href="/legal/youth" className="underline underline-offset-4">
            청소년보호정책
          </Link>
        </p>
      </fieldset>

      <p
        id="signup-error"
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>

      <Button
        type="submit"
        size="lg"
        loading={pending}
        disabled={!formOk}
        aria-describedby={invalid ? "signup-error" : undefined}
        data-testid="signup-submit"
      >
        동의하고 가입하기
      </Button>
    </form>
  );
}
