"use client";

/**
 * S3 기본 정보·활동 시간대 — /onboarding/basic (12_flows §2 S3, 10_brand #5·#6).
 * 닉네임 2~10 · 성별(선택 안 함 허용) · 지역 2단(시도 → 시군구) · 활동 시간대 7×4 그리드(최소 1칸) → saveBasic → redirectTo.
 * 뒤로가기 없음(S2 로 못 감). 재방문 시 스냅샷 프리필.
 */
import * as React from "react";
import { Button, Input, Label, RadioGroup, RadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@duckmate/ui";
import { AVAILABILITY_SLOTS, GENDERS, NICKNAME_MAX, type Enums } from "@duckmate/db";
import { track } from "@/lib/analytics/track";
import { useStepTimer } from "@/lib/analytics/useTrack";
import { saveBasic } from "@/lib/onboarding/actions";
import { basicSchema, nicknameSchema } from "@/lib/onboarding/schemas";
import { REGION } from "@duckmate/db";
import { useOnboardingDraft, type BasicDraft } from "@/stores/onboardingDraft";
import { COPY } from "./copy";
import { FieldError, OnboardingFrame } from "./OnboardingFrame";
import { sidoList, sigunguList, type RegionItem } from "./regions";
import { useActionResult } from "./useActionResult";

type Slot = Enums["availability_slot"];
type Cell = { weekday: number; slot: Slot };
const cellKey = (c: Cell) => `${c.weekday}:${c.slot}`;

export interface BasicScreenProps {
  regions: RegionItem[];
  initial: { nickname: string | null; gender: Enums["gender"] | null; regionCode: string | null; availability: Cell[] };
}

export function BasicScreen({ regions, initial }: BasicScreenProps) {
  const timer = useStepTimer();
  const draft = useOnboardingDraft((s) => s.basic);
  const setDraft = useOnboardingDraft((s) => s.setBasic);
  const { handle, run, pending, go } = useActionResult();

  const start: BasicDraft = draft ?? {
    nickname: initial.nickname ?? "",
    gender: initial.gender,
    sidoCode: initial.regionCode ? REGION.sidoCodeOf(initial.regionCode) : null,
    regionCode: initial.regionCode,
    availability: initial.availability,
  };
  const [nickname, setNickname] = React.useState(start.nickname);
  const [gender, setGender] = React.useState<Enums["gender"] | null>(start.gender);
  const [sidoCode, setSidoCode] = React.useState<string | null>(start.sidoCode);
  const [regionCode, setRegionCode] = React.useState<string | null>(start.regionCode);
  const [cells, setCells] = React.useState<Set<string>>(() => new Set(start.availability.map(cellKey)));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const nickRef = React.useRef<HTMLInputElement>(null);

  const sidos = React.useMemo(() => sidoList(regions), [regions]);
  const sigungus = React.useMemo(() => (sidoCode ? sigunguList(regions, sidoCode) : []), [regions, sidoCode]);

  // 시도 폴백 행(XX000)은 시군구가 1개뿐 → 자동 선택
  React.useEffect(() => {
    if (sidoCode && sigungus.length === 1 && sigungus[0]) setRegionCode(sigungus[0].code);
  }, [sidoCode, sigungus]);

  const availability = React.useMemo<Cell[]>(
    () =>
      Array.from(cells).map((k) => {
        const [w, s] = k.split(":") as [string, Slot];
        return { weekday: Number(w), slot: s };
      }),
    [cells],
  );

  const persistDraft = () => setDraft({ nickname, gender, sidoCode, regionCode, availability });

  const toggle = (c: Cell) =>
    setCells((prev) => {
      const next = new Set(prev);
      const k = cellKey(c);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const quick = (list: Cell[]) =>
    setCells((prev) => {
      const next = new Set(prev);
      const allOn = list.every((c) => next.has(cellKey(c)));
      for (const c of list) {
        if (allOn) next.delete(cellKey(c));
        else next.add(cellKey(c));
      }
      return next;
    });

  const weekdayEvening: Cell[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, slot: "evening" }));
  const weekendDay: Cell[] = [6, 7].flatMap((weekday) => [{ weekday, slot: "morning" as Slot }, { weekday, slot: "afternoon" as Slot }]);

  const nicknameOk = nicknameSchema.safeParse(nickname).success;
  const canSubmit = nicknameOk && gender !== null && regionCode !== null && cells.size > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { nickname: nickname.trim(), gender, regionCode, availability };
    const parsed = basicSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const f = String(issue.path[0] ?? "form");
        if (!next[f]) next[f] = issue.message;
      }
      setErrors(next);
      if (next["nickname"]) nickRef.current?.focus();
      return;
    }
    setErrors({});
    persistDraft();
    const res = await run(() => saveBasic(parsed.data));
    handle(res, {
      onSuccess: ({ redirectTo }) => {
        const duration = timer.elapsed();
        track("onboarding_step_completed", { step: "basic", duration_ms: duration });
        track("onboarding_step_completed", { step: "availability", duration_ms: duration, cell_count: availability.length });
        setDraft(null);
        go(redirectTo);
      },
      onFieldError: (field, message) => {
        setErrors({ [field]: message });
        if (field === "nickname") nickRef.current?.focus();
      },
    });
  };

  return (
    <OnboardingFrame
      step={3}
      headline={COPY.basic.headline}
      sub={COPY.basic.sub}
      testId="basic-screen"
      footer={
        <Button type="submit" form="basic-form" size="lg" disabled={!canSubmit} loading={pending} data-testid="onb-next">
          {COPY.basic.next}
        </Button>
      }
    >
      <form id="basic-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
        {/* 닉네임 */}
        <div>
          <Label htmlFor="nickname" required hint={COPY.basic.nicknameHint}>
            {COPY.basic.nickname}
          </Label>
          <Input
            ref={nickRef}
            id="nickname"
            autoComplete="nickname"
            maxLength={NICKNAME_MAX}
            value={nickname}
            invalid={Boolean(errors["nickname"])}
            aria-describedby={errors["nickname"] ? "nickname-error" : undefined}
            data-testid="nickname-input"
            className="mt-1.5"
            onChange={(e) => setNickname(e.target.value)}
          />
          <FieldError id="nickname-error" message={errors["nickname"]} />
        </div>

        {/* 성별 */}
        <fieldset aria-describedby={errors["gender"] ? "gender-error" : undefined}>
          <legend className="text-label text-foreground">
            {COPY.basic.gender}
            <span className="ml-0.5 text-coral-700 dark:text-coral-300" aria-hidden="true">*</span>
            <span className="sr-only">(필수)</span>
          </legend>
          <RadioGroup value={gender ?? ""} onValueChange={(v) => setGender(v as Enums["gender"])} className="mt-2 grid grid-cols-3 gap-2" aria-label={COPY.basic.gender}>
            {GENDERS.map((g) => (
              <label
                key={g}
                htmlFor={`gender-${g}`}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-body-sm",
                  gender === g ? "border-primary bg-violet-100 text-violet-700 dark:bg-violet-800 dark:text-violet-200" : "border-border bg-card text-foreground",
                )}
              >
                <RadioGroupItem id={`gender-${g}`} value={g} data-testid={`gender-${g}`} className="sr-only" />
                {COPY.basic.genders[g]}
              </label>
            ))}
          </RadioGroup>
          <FieldError id="gender-error" message={errors["gender"]} />
        </fieldset>

        {/* 지역 */}
        <div>
          <Label htmlFor="sido" required hint={COPY.basic.regionHint}>
            {COPY.basic.region}
          </Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <Select
              value={sidoCode ?? ""}
              onValueChange={(v) => {
                setSidoCode(v);
                setRegionCode(null);
              }}
            >
              <SelectTrigger id="sido" aria-label={COPY.basic.sido} data-testid="region-sido" invalid={Boolean(errors["regionCode"]) && !sidoCode}>
                <SelectValue placeholder={COPY.basic.sido} />
              </SelectTrigger>
              <SelectContent>
                {sidos.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={regionCode ?? ""} onValueChange={setRegionCode} disabled={!sidoCode}>
              <SelectTrigger aria-label={COPY.basic.sigungu} data-testid="region-sigungu" invalid={Boolean(errors["regionCode"])} aria-describedby={errors["regionCode"] ? "region-error" : undefined}>
                <SelectValue placeholder={COPY.basic.sigungu} />
              </SelectTrigger>
              <SelectContent>
                {sigungus.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.sigungu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FieldError id="region-error" message={errors["regionCode"]} />
        </div>

        {/* 활동 시간대 */}
        <fieldset aria-describedby={errors["availability"] ? "availability-error" : "availability-hint"}>
          <legend className="text-h3 text-foreground">{COPY.basic.availabilityHeadline}</legend>
          <p id="availability-hint" className="mt-1 text-body-sm text-muted-foreground">
            {COPY.basic.availabilitySub}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-center" data-testid="availability-grid">
              <thead>
                <tr>
                  <th scope="col" className="sr-only">시간대</th>
                  {COPY.basic.weekdays.map((d) => (
                    <th key={d} scope="col" className="text-caption font-medium text-muted-foreground">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AVAILABILITY_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <th scope="row" className="pr-1 text-left text-caption font-medium text-muted-foreground">
                      {COPY.basic.slots[slot]}
                    </th>
                    {COPY.basic.weekdays.map((d, i) => {
                      const c: Cell = { weekday: i + 1, slot };
                      const on = cells.has(cellKey(c));
                      return (
                        <td key={d} className="p-0">
                          <button
                            type="button"
                            aria-pressed={on}
                            aria-label={`${d}요일 ${COPY.basic.slots[slot]}`}
                            data-testid={`avail-${c.weekday}-${slot}`}
                            onClick={() => toggle(c)}
                            className={cn(
                              "h-9 w-full min-w-9 rounded-sm border transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                              on ? "border-primary bg-primary" : "border-border bg-card hover:bg-muted",
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" data-testid="avail-quick-weekday-evening" onClick={() => quick(weekdayEvening)}>
              {COPY.basic.quick.weekdayEvening}
            </Button>
            <Button type="button" variant="outline" size="sm" data-testid="avail-quick-weekend-day" onClick={() => quick(weekendDay)}>
              {COPY.basic.quick.weekendDay}
            </Button>
            <span className="tnum self-center text-caption text-muted-foreground" role="status" aria-live="polite">
              {cells.size}칸 선택
            </span>
          </div>
          <FieldError id="availability-error" message={errors["availability"]} />
        </fieldset>
      </form>
    </OnboardingFrame>
  );
}
