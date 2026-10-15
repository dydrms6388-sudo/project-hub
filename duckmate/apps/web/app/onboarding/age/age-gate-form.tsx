"use client";

// E1 · 연령 게이트 입력 — 만 19세 미만이면 차단 화면으로 전환(입력 미저장).
// 통과 시 /signup?birth=YYYY-MM-DD 로 프리필 이동 (서버 저장은 가입 시점에만).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@duckmate/ui";
import { isAdultBirthDate } from "@/lib/auth/schemas";
import { signOut } from "@/lib/auth/actions";

function pad2(v: string) {
  return v.padStart(2, "0");
}

export function AgeGateForm({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const birthDate = useMemo(
    () => (year.length === 4 && month && day ? `${year}-${pad2(month)}-${pad2(day)}` : ""),
    [year, month, day]
  );

  function focusById(id: string) {
    document.getElementById(id)?.focus();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!birthDate) {
      setError("생년월일을 모두 입력해 주세요.");
      return;
    }
    if (!isAdultBirthDate(birthDate)) {
      // 입력값은 서버로 보내지 않는다 — 미저장 원칙(A5 §1.3-1)
      setDenied(true);
      return;
    }
    if (loggedIn) {
      router.replace("/onboarding/phone");
      return;
    }
    router.push(`/signup?birth=${birthDate}`);
  }

  if (denied) {
    return (
      <div role="alert" data-testid="age-denied">
        <h2 className="text-h2">만 19세 이상부터 이용할 수 있어요</h2>
        <p className="mt-2 text-body-sm text-ink-muted">
          입력하신 생년월일은 저장하지 않았어요. 성인이 된 뒤에 다시 찾아와 주세요.
        </p>
        <div className="mt-4">
          <Button
            size="lg"
            loading={pending}
            data-testid="age-denied-confirm"
            onClick={() =>
              startTransition(async () => {
                if (loggedIn) await signOut();
                router.replace("/");
              })
            }
          >
            확인
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" data-testid="age-form">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-body-sm font-semibold">생년월일</legend>
        <div className="flex items-center gap-2">
          <Input
            id="age-year"
            aria-label="출생 연도 4자리"
            inputMode="numeric"
            maxLength={4}
            placeholder="1999"
            className="w-24"
            value={year}
            invalid={error !== null}
            aria-describedby={error ? "age-error" : undefined}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setYear(v);
              if (v.length === 4) focusById("age-month");
            }}
            data-testid="age-year"
          />
          <span aria-hidden="true" className="text-ink-muted">
            /
          </span>
          <Input
            id="age-month"
            aria-label="출생 월"
            inputMode="numeric"
            maxLength={2}
            placeholder="03"
            className="w-16"
            value={month}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
              setMonth(v);
              if (v.length === 2) focusById("age-day");
            }}
            data-testid="age-month"
          />
          <span aria-hidden="true" className="text-ink-muted">
            /
          </span>
          <Input
            id="age-day"
            aria-label="출생 일"
            inputMode="numeric"
            maxLength={2}
            placeholder="21"
            className="w-16"
            value={day}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
            data-testid="age-day"
          />
        </div>
      </fieldset>

      <p
        id="age-error"
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>

      <Button type="submit" size="lg" data-testid="age-submit">
        다음
      </Button>
    </form>
  );
}
