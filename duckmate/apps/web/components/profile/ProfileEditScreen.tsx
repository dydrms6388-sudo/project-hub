"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { AVAILABILITY_SLOTS, BIO_MAX, FAV_NOTE_MAX, GENDERS, HOBBY_MAX, HOBBY_MIN, NICKNAME_MAX, NOW_INTO_MAX, type Enums } from "@duckmate/db";
import { Button, HobbyChip, INTENSITY_LABELS, Input, Label, RadioCard, RadioGroup, Textarea, cn, useToast } from "@duckmate/ui";
import type { ActionResult } from "@/lib/auth/errors";
import { saveBasic, saveCard, saveHobbies, saveQuizAnswers } from "@/lib/onboarding/actions";
import { updateBio } from "@/app/(app)/me/edit/actions";
import { GENDER_LABELS, SLOT_LABELS, WEEKDAY_LABELS, formatDateKo, nextNicknameChangeAt } from "./format";
import type { ProfileEditData } from "./types";

type Section = "card" | "hobbies" | "quiz" | "basic" | "bio";

function useSaver() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<Section | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = <T,>(section: Section, fn: () => Promise<ActionResult<T>>, onOk?: (d: T) => void) =>
    start(async () => {
      setBusy(section);
      setErrors({});
      const r = await fn();
      setBusy(null);
      if (!r.ok) {
        if (r.redirectTo) {
          router.replace(r.redirectTo);
          return;
        }
        if (r.field) setErrors({ [r.field]: r.message });
        toast({ title: r.message, variant: "error" });
        return;
      }
      toast({ title: "저장했어요", variant: "success" });
      onOk?.(r.data);
      router.refresh();
    });
  return { run, busy: pending ? busy : null, errors };
}

function SectionCard({ id, title, hint, children }: { id: Section | "availability"; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 rounded-lg border border-border bg-card p-4">
      <h2 className="text-h3">{title}</h2>
      {hint ? <p className="text-body-sm mt-1 text-muted-foreground">{hint}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function ProfileEditScreen({ data }: { data: ProfileEditData }) {
  const { run, busy, errors } = useSaver();

  // ---- #card ----
  const [nowInto, setNowInto] = useState(data.profile.nowInto ?? "");
  const rank1 = data.myHobbies.find((h) => h.rank === 1);
  const [favNote, setFavNote] = useState(rank1?.favNote ?? "");

  // ---- #hobbies ----
  const [selected, setSelected] = useState<Array<{ hobbyId: number; intensity: number }>>(
    [...data.myHobbies].sort((a, b) => a.rank - b.rank).map((h) => ({ hobbyId: h.hobbyId, intensity: h.intensity })),
  );
  const hobbyById = useMemo(() => new Map(data.hobbies.map((h) => [h.id, h])), [data.hobbies]);
  const grouped = useMemo(() => {
    const m = new Map<string, typeof data.hobbies>();
    for (const h of data.hobbies) {
      const list = m.get(h.categoryName) ?? [];
      list.push(h);
      m.set(h.categoryName, list);
    }
    return [...m.entries()];
  }, [data.hobbies]);
  const toggleHobby = (id: number) =>
    setSelected((s) => {
      if (s.some((x) => x.hobbyId === id)) return s.filter((x) => x.hobbyId !== id);
      if (s.length >= HOBBY_MAX) return s;
      return [...s, { hobbyId: id, intensity: 2 }];
    });
  const setIntensity = (id: number, intensity: number) => setSelected((s) => s.map((x) => (x.hobbyId === id ? { ...x, intensity } : x)));

  // ---- #quiz ----
  const [answers, setAnswers] = useState<Record<number, number>>(data.quiz.answers);
  const quizDirty = Object.entries(answers).filter(([q, c]) => data.quiz.answers[Number(q)] !== c);

  // ---- #basic + #availability ----
  const [nickname, setNickname] = useState(data.profile.nickname);
  const [gender, setGender] = useState<Enums["gender"]>(data.profile.gender ?? "unspecified");
  const [regionCode, setRegionCode] = useState(data.profile.regionCode ?? "");
  const [availability, setAvailability] = useState<Set<string>>(new Set(data.availability.map((a) => `${a.weekday}:${a.slot}`)));
  const nextChange = nextNicknameChangeAt(data.profile.nicknameChangedAt);
  const toggleCell = (weekday: number, slot: string) =>
    setAvailability((s) => {
      const n = new Set(s);
      const k = `${weekday}:${slot}`;
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  // ---- #bio ----
  const [bio, setBio] = useState(data.profile.bio ?? "");

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="me-edit-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/me" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">프로필 편집</h1>
      </header>

      <nav aria-label="편집 섹션" className="-mx-4 mb-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {(
            [
              ["#card", "카드"],
              ["#hobbies", "취미"],
              ["#quiz", "퀴즈"],
              ["#availability", "시간대"],
              ["#bio", "소개"],
            ] as const
          ).map(([href, label]) => (
            <li key={href} className="shrink-0">
              <a href={href} className="text-label inline-flex h-9 items-center rounded-full border border-border bg-card px-3 hover:bg-muted">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-4">
        <SectionCard id="card" title="덕질 카드" hint="카드 1면의 '요즘 빠진 것'과 최애 한 줄이에요.">
          <div>
            <Label htmlFor="nowInto" required hint={`${nowInto.length}/${NOW_INTO_MAX}`}>
              요즘 빠진 것
            </Label>
            <Input id="nowInto" value={nowInto} maxLength={NOW_INTO_MAX} onChange={(e) => setNowInto(e.target.value)} invalid={Boolean(errors.nowInto)} />
            {errors.nowInto ? <p className="text-caption mt-1 text-destructive">{errors.nowInto}</p> : null}
          </div>
          <div>
            <Label htmlFor="favNote" hint={`${favNote.length}/${FAV_NOTE_MAX}`}>
              최애 (1순위 취미)
            </Label>
            <Input id="favNote" value={favNote} maxLength={FAV_NOTE_MAX} onChange={(e) => setFavNote(e.target.value)} invalid={Boolean(errors.favNote)} placeholder="비우면 카드에서 숨겨요" />
            {errors.favNote ? <p className="text-caption mt-1 text-destructive">{errors.favNote}</p> : null}
          </div>
          <Button className="w-full" loading={busy === "card"} disabled={nowInto.trim().length === 0} onClick={() => run("card", () => saveCard({ nowInto, favNote }))} data-testid="save-card">
            카드 저장
          </Button>
        </SectionCard>

        <SectionCard id="hobbies" title="취미 Top3" hint={`${HOBBY_MIN}~${HOBBY_MAX}개를 고른 순서가 순위예요. 앞의 3개가 카드에 보여요.`}>
          {selected.length > 0 ? (
            <ol className="space-y-2">
              {selected.map((s, i) => {
                const h = hobbyById.get(s.hobbyId);
                return (
                  <li key={s.hobbyId} className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="tnum text-label w-5 text-primary">{i + 1}</span>
                      <span className="text-body flex-1">{h?.name ?? s.hobbyId}</span>
                      <button type="button" className="text-caption text-muted-foreground underline underline-offset-4" onClick={() => toggleHobby(s.hobbyId)}>
                        빼기
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${h?.name ?? ""} 몰입도`}>
                      {([1, 2, 3, 4, 5] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={s.intensity === v}
                          onClick={() => setIntensity(s.hobbyId, v)}
                          className={cn("text-caption h-8 rounded-full border px-2.5", s.intensity === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
                        >
                          {INTENSITY_LABELS[v]}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <p className="text-label mb-2 text-muted-foreground">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((h) => (
                  <HobbyChip key={h.id} label={h.name} category={h.categorySlug} selected={selected.some((s) => s.hobbyId === h.id)} onClick={() => toggleHobby(h.id)} size="sm" />
                ))}
              </div>
            </div>
          ))}
          {errors.hobbies ? <p className="text-caption text-destructive">{errors.hobbies}</p> : null}
          <Button
            className="w-full"
            loading={busy === "hobbies"}
            disabled={selected.length < HOBBY_MIN}
            onClick={() =>
              run("hobbies", () =>
                saveHobbies({
                  hobbies: selected.map((s, i) => ({ hobbyId: s.hobbyId, rank: i + 1, intensity: s.intensity, ...(i === 0 && favNote.trim() ? { favNote: favNote.trim() } : {}) })),
                }),
              )
            }
            data-testid="save-hobbies"
          >
            취미 저장 ({selected.length}/{HOBBY_MAX})
          </Button>
        </SectionCard>

        <SectionCard id="quiz" title="궁합 퀴즈" hint={`${Object.keys(answers).length}/${data.quiz.questions.length} 답했어요. 3문항 이상이면 궁합에 반영돼요.`}>
          {data.quiz.questions.map((q, i) => (
            <fieldset key={q.id}>
              <legend className="text-body mb-2 font-medium">
                <span className="tnum text-primary">Q{i + 1}.</span> {q.text}
              </legend>
              <RadioGroup value={answers[q.id] ? String(answers[q.id]) : undefined} onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))} className="space-y-2">
                {q.options.map((o) => (
                  <RadioCard key={o.value} value={String(o.value)} label={o.label} />
                ))}
              </RadioGroup>
            </fieldset>
          ))}
          <Button
            className="w-full"
            loading={busy === "quiz"}
            disabled={quizDirty.length === 0}
            onClick={() => run("quiz", () => saveQuizAnswers({ answers: quizDirty.map(([q, c]) => ({ questionId: Number(q), choice: c })) }))}
            data-testid="save-quiz"
          >
            퀴즈 저장 {quizDirty.length > 0 ? `(${quizDirty.length}문항)` : ""}
          </Button>
        </SectionCard>

        <SectionCard id="basic" title="기본 정보 · 활동 시간대" hint="닉네임은 30일에 한 번 바꿀 수 있어요.">
          <div id="availability" className="scroll-mt-16" />
          <div>
            <Label htmlFor="nickname" required hint={nextChange ? `다음 변경 가능일: ${formatDateKo(nextChange.toISOString())}` : `${nickname.length}/${NICKNAME_MAX}`}>
              닉네임
            </Label>
            <Input id="nickname" value={nickname} maxLength={NICKNAME_MAX} onChange={(e) => setNickname(e.target.value)} invalid={Boolean(errors.nickname)} disabled={Boolean(nextChange)} />
            {errors.nickname ? <p className="text-caption mt-1 text-destructive">{errors.nickname}</p> : null}
          </div>
          <fieldset>
            <legend className="text-label mb-2">성별</legend>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={gender === g}
                  onClick={() => setGender(g)}
                  className={cn("text-label h-10 flex-1 rounded-md border", gender === g ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
                >
                  {GENDER_LABELS[g]}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="region" required>
              지역 (시/군/구)
            </Label>
            <select
              id="region"
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              className={cn("text-body h-12 w-full rounded-md border border-input bg-card px-3", errors.regionCode && "border-destructive")}
            >
              <option value="">선택해 주세요</option>
              {data.regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.sido} {r.sigungu}
                </option>
              ))}
            </select>
            {errors.regionCode ? <p className="text-caption mt-1 text-destructive">{errors.regionCode}</p> : null}
          </div>
          <div>
            <p className="text-label mb-2">활동 시간대 ({availability.size}칸)</p>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-center">
                <thead>
                  <tr>
                    <th className="text-caption w-10 text-muted-foreground" scope="col">
                      <span className="sr-only">시간대</span>
                    </th>
                    {WEEKDAY_LABELS.map((d) => (
                      <th key={d} className="text-caption text-muted-foreground" scope="col">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AVAILABILITY_SLOTS.map((slot) => (
                    <tr key={slot}>
                      <th className="text-caption text-muted-foreground" scope="row">
                        {SLOT_LABELS[slot]}
                      </th>
                      {WEEKDAY_LABELS.map((d, i) => {
                        const on = availability.has(`${i + 1}:${slot}`);
                        return (
                          <td key={d}>
                            <button
                              type="button"
                              aria-pressed={on}
                              aria-label={`${d} ${SLOT_LABELS[slot]}`}
                              onClick={() => toggleCell(i + 1, slot)}
                              className={cn("h-9 w-full rounded-md border", on ? "border-primary bg-primary" : "border-border bg-card")}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errors.availability ? <p className="text-caption mt-1 text-destructive">{errors.availability}</p> : null}
          </div>
          <Button
            className="w-full"
            loading={busy === "basic"}
            disabled={!nickname.trim() || !regionCode || availability.size === 0}
            onClick={() =>
              run("basic", () =>
                saveBasic({
                  nickname: nickname.trim(),
                  gender,
                  regionCode,
                  availability: [...availability].map((k) => {
                    const [w, s] = k.split(":") as [string, Enums["availability_slot"]];
                    return { weekday: Number(w), slot: s };
                  }),
                }),
              )
            }
            data-testid="save-basic"
          >
            기본 정보 저장
          </Button>
        </SectionCard>

        <SectionCard id="bio" title="소개" hint="연락처·SNS 계정은 넣을 수 없어요.">
          <div>
            <Label htmlFor="bio" hint={`${bio.length}/${BIO_MAX}`}>
              나를 한마디로
            </Label>
            <Textarea id="bio" value={bio} maxLength={BIO_MAX} rows={4} onChange={(e) => setBio(e.target.value)} invalid={Boolean(errors.bio)} />
            {errors.bio ? <p className="text-caption mt-1 text-destructive">{errors.bio}</p> : null}
          </div>
          <Button className="w-full" loading={busy === "bio"} onClick={() => run("bio", () => updateBio({ bio }))} data-testid="save-bio">
            소개 저장
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}
