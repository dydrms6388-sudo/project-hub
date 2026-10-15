"use client";

/**
 * S4 취미 선택 — /onboarding/hobbies (12_flows §2 S4, 10_brand #7·#8).
 * 검색창 최상단 → 카테고리 12(초기 8 + 더보기) → 세부 5칩. 3~5개, 6번째 탭 시 토스트 "5개까지 고를 수 있어요".
 * 칩 탭 → 선택 + 인라인 시트(몰입도 5단계 라디오, 기본 2 "가끔" + 최애 30자). 선택 순서 = rank, Top3 는 "위로" 버튼으로 변경(드래그 대체).
 * 저장: saveHobbies (전체 교체) → quiz.
 */
import * as React from "react";
import { Search } from "lucide-react";
import {
  Button, HobbyChip, INTENSITY_LABELS, Input, Label, RadioCard, RadioGroup, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, cn, useToast,
} from "@duckmate/ui";
import { FAV_NOTE_MAX, HOBBY_MAX, HOBBY_MIN } from "@duckmate/db";
import { track } from "@/lib/analytics/track";
import { useStepTimer } from "@/lib/analytics/useTrack";
import { saveHobbies } from "@/lib/onboarding/actions";
import { hobbiesSchema } from "@/lib/onboarding/schemas";
import { checkText, textRuleMessage } from "@/lib/onboarding/text-rules";
import { useOnboardingDraft, type HobbyDraftItem } from "@/stores/onboardingDraft";
import { COPY } from "./copy";
import { categoryOf, hobbyById, searchHobbies, uiCategorySlug, type HobbyCategoryItem, type HobbyItem } from "./hobbies";
import { FieldError, OnboardingFrame } from "./OnboardingFrame";
import { useActionResult } from "./useActionResult";

type Intensity = 1 | 2 | 3 | 4 | 5;
const INTENSITIES: Intensity[] = [1, 2, 3, 4, 5];

export interface HobbiesScreenProps {
  categories: HobbyCategoryItem[];
  hobbies: HobbyItem[];
  initial: Array<{ hobbyId: number; rank: number; intensity: number; favNote: string | null }>;
}

export function HobbiesScreen({ categories, hobbies, initial }: HobbiesScreenProps) {
  const timer = useStepTimer();
  const { toast } = useToast();
  const draft = useOnboardingDraft((s) => s.hobbies);
  const setDraft = useOnboardingDraft((s) => s.setHobbies);
  const { handle, run, pending, go } = useActionResult();

  const [selected, setSelected] = React.useState<HobbyDraftItem[]>(
    () =>
      draft ??
      [...initial]
        .sort((a, b) => a.rank - b.rank)
        .map((h) => ({ hobbyId: h.hobbyId, intensity: clampIntensity(h.intensity), favNote: h.favNote ?? "" })),
  );
  const [query, setQuery] = React.useState("");
  const [showMore, setShowMore] = React.useState(false);
  const [openCat, setOpenCat] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [favErrors, setFavErrors] = React.useState<Record<number, string>>({});

  const visibleCats = React.useMemo(() => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    return showMore ? sorted : sorted.filter((c) => c.isInitial);
  }, [categories, showMore]);
  const results = React.useMemo(() => searchHobbies(hobbies, categories, query), [hobbies, categories, query]);
  const catHobbies = React.useMemo(() => (openCat === null ? [] : hobbies.filter((h) => h.categoryId === openCat).sort((a, b) => a.sortOrder - b.sortOrder)), [hobbies, openCat]);

  const isSelected = (id: number) => selected.some((s) => s.hobbyId === id);

  const onChipTap = (h: HobbyItem) => {
    if (isSelected(h.id)) {
      setEditing(h.id);
      return;
    }
    if (selected.length >= HOBBY_MAX) {
      toast({ title: COPY.hobbies.max });
      return;
    }
    setSelected((prev) => [...prev, { hobbyId: h.id, intensity: 2, favNote: "" }]);
    setEditing(h.id);
  };

  const update = (id: number, patch: Partial<HobbyDraftItem>) => setSelected((prev) => prev.map((s) => (s.hobbyId === id ? { ...s, ...patch } : s)));
  const remove = (id: number) => {
    setSelected((prev) => prev.filter((s) => s.hobbyId !== id));
    setFavErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const moveUp = (id: number) =>
    setSelected((prev) => {
      const i = prev.findIndex((s) => s.hobbyId === id);
      if (i <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      if (item) next.splice(i - 1, 0, item);
      return next;
    });

  const canSubmit = selected.length >= HOBBY_MIN && selected.length <= HOBBY_MAX;

  const onSubmit = async () => {
    // 최애 클라이언트 사전 검사(서버와 같은 규칙)
    const favErr: Record<number, string> = {};
    for (const s of selected) {
      if (s.favNote.trim()) {
        const hit = checkText(s.favNote);
        if (hit) favErr[s.hobbyId] = textRuleMessage(hit, "최애");
      }
    }
    if (Object.keys(favErr).length > 0) {
      setFavErrors(favErr);
      setEditing(Number(Object.keys(favErr)[0]));
      return;
    }
    const input = { hobbies: selected.map((s, i) => ({ hobbyId: s.hobbyId, rank: i + 1, intensity: s.intensity, favNote: s.favNote.trim() || undefined })) };
    const parsed = hobbiesSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "다시 확인해 주세요");
      return;
    }
    setError(null);
    setDraft(selected);
    const res = await run(() => saveHobbies(parsed.data));
    handle(res, {
      onSuccess: ({ redirectTo }) => {
        track("onboarding_step_completed", { step: "hobbies", duration_ms: timer.elapsed(), hobby_count: selected.length });
        setDraft(null);
        go(redirectTo);
      },
      onFieldError: (field, message) => {
        const m = /^hobbies\.(\d+)\.favNote$/.exec(field);
        if (m) {
          const rank = Number(m[1]);
          const item = selected[rank - 1];
          if (item) {
            setFavErrors({ [item.hobbyId]: message });
            setEditing(item.hobbyId);
            return;
          }
        }
        setError(message);
      },
    });
  };

  const editingHobby = editing !== null ? hobbyById(hobbies, editing) : undefined;
  const editingItem = editing !== null ? selected.find((s) => s.hobbyId === editing) : undefined;

  return (
    <OnboardingFrame
      step={4}
      backHref="/onboarding/basic"
      headline={COPY.hobbies.headline}
      sub={COPY.hobbies.sub}
      testId="hobbies-screen"
      footer={
        <>
          <Button size="lg" disabled={!canSubmit} loading={pending} data-testid="onb-next" onClick={onSubmit}>
            {COPY.hobbies.next}
            <span className="tnum ml-1 text-body-sm opacity-80">
              ({selected.length}/{HOBBY_MAX})
            </span>
          </Button>
          {!canSubmit ? (
            <p className="text-center text-caption text-muted-foreground" role="status">
              {COPY.hobbies.minHint}
            </p>
          ) : null}
        </>
      }
    >
      {/* 검색 */}
      <div className="relative">
        <Search size={20} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sand-500" />
        <Label htmlFor="hobby-search" className="sr-only">
          {COPY.hobbies.search}
        </Label>
        <Input id="hobby-search" type="search" placeholder={COPY.hobbies.search} value={query} data-testid="hobby-search" className="pl-11" onChange={(e) => setQuery(e.target.value)} />
      </div>
      {query.trim() ? (
        <ul className="flex flex-wrap gap-2" aria-label="검색 결과" data-testid="hobby-search-results">
          {results.length === 0 ? <li className="text-body-sm text-muted-foreground">검색 결과가 없어요</li> : null}
          {results.map((h) => (
            <li key={h.id}>
              <ChipFor hobby={h} categories={categories} selected={isSelected(h.id)} onClick={() => onChipTap(h)} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* 카테고리 */}
      <section aria-labelledby="cat-heading">
        <h2 id="cat-heading" className="sr-only">카테고리</h2>
        <ul className="flex flex-wrap gap-2">
          {visibleCats.map((c) => (
            <li key={c.id}>
              <HobbyChip
                label={c.name}
                category={uiCategorySlug(c.slug)}
                selected={openCat === c.id}
                data-testid={`hobby-cat-${c.slug}`}
                aria-expanded={openCat === c.id}
                onClick={() => setOpenCat((prev) => (prev === c.id ? null : c.id))}
              />
            </li>
          ))}
          <li>
            <Button type="button" variant="ghost" size="sm" data-testid="hobby-more" onClick={() => setShowMore((v) => !v)}>
              {showMore ? COPY.hobbies.less : `${COPY.hobbies.more} ›`}
            </Button>
          </li>
        </ul>
        {openCat !== null ? (
          <ul className="mt-3 flex flex-wrap gap-2 rounded-lg border border-border bg-muted/40 p-3" aria-label={categoryOf(categories, openCat)?.name} data-testid="hobby-subchips">
            {catHobbies.map((h) => (
              <li key={h.id}>
                <ChipFor hobby={h} categories={categories} selected={isSelected(h.id)} onClick={() => onChipTap(h)} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* 선택됨 */}
      <section aria-labelledby="sel-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="sel-heading" className="text-label text-foreground tnum">
            {COPY.hobbies.selected(selected.length, HOBBY_MAX)}
          </h2>
          <span className="text-caption text-muted-foreground">{COPY.hobbies.rankHint}</span>
        </div>
        {selected.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">위에서 취미를 골라 주세요</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2" data-testid="hobby-selected">
            {selected.map((s, i) => {
              const h = hobbyById(hobbies, s.hobbyId);
              const cat = h ? categoryOf(categories, h.categoryId) : undefined;
              return (
                <li key={s.hobbyId} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2" data-testid={`hobby-selected-${h?.slug ?? s.hobbyId}`}>
                  <span className="tnum inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-caption" aria-label={`${i + 1}순위`}>
                    {i + 1}
                  </span>
                  <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm" onClick={() => setEditing(s.hobbyId)} data-testid={`hobby-edit-${h?.slug ?? s.hobbyId}`}>
                    <span className="block truncate text-body-sm text-foreground">
                      <span aria-hidden="true" className="mr-1">{h?.icon ?? cat?.icon}</span>
                      {h?.name ?? s.hobbyId}
                      <span className="ml-2 text-caption text-muted-foreground">★{s.intensity} {INTENSITY_LABELS[s.intensity]}</span>
                    </span>
                    <span className="block truncate text-caption text-muted-foreground">{s.favNote ? `최애: ${s.favNote}` : "+ 최애"}</span>
                  </button>
                  <Button type="button" variant="ghost" size="sm" disabled={i === 0} aria-label={`${h?.name ?? ""} ${COPY.hobbies.up}`} data-testid={`hobby-up-${h?.slug ?? s.hobbyId}`} onClick={() => moveUp(s.hobbyId)}>
                    ↑
                  </Button>
                  <Button type="button" variant="ghost" size="sm" aria-label={`${h?.name ?? ""} ${COPY.hobbies.remove}`} data-testid={`hobby-remove-${h?.slug ?? s.hobbyId}`} onClick={() => remove(s.hobbyId)}>
                    ✕
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
        <FieldError id="hobbies-error" message={error} />
      </section>

      <p className="text-caption text-muted-foreground">
        {COPY.hobbies.request} <span className="text-sand-500">· {COPY.hobbies.requestNote}</span>
      </p>

      {/* 인라인 시트: 몰입도 + 최애 */}
      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent bottomCloseLabel={COPY.hobbies.done} data-testid="hobby-sheet">
          {editingHobby && editingItem ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  <span aria-hidden="true" className="mr-1">{editingHobby.icon}</span>
                  {editingHobby.name} · {COPY.hobbies.sheetTitle}
                </SheetTitle>
                <SheetDescription>{COPY.hobbies.beginner}</SheetDescription>
              </SheetHeader>
              <RadioGroup value={String(editingItem.intensity)} onValueChange={(v) => update(editingHobby.id, { intensity: clampIntensity(Number(v)) })} className="mt-3" aria-label="몰입도">
                {INTENSITIES.map((n) => (
                  <RadioCard key={n} value={String(n)} label={`${"★".repeat(n)} ${INTENSITY_LABELS[n]}`} data-testid={`intensity-${n}`} />
                ))}
              </RadioGroup>
              <div className="mt-4">
                <Label htmlFor="fav-note" hint={`${editingItem.favNote.length}/${FAV_NOTE_MAX}`}>
                  {COPY.hobbies.favNote}
                </Label>
                <Input
                  id="fav-note"
                  maxLength={FAV_NOTE_MAX}
                  value={editingItem.favNote}
                  invalid={Boolean(favErrors[editingHobby.id])}
                  aria-describedby={favErrors[editingHobby.id] ? "fav-note-error" : undefined}
                  data-testid="fav-note-input"
                  className="mt-1.5"
                  onChange={(e) => {
                    update(editingHobby.id, { favNote: e.target.value });
                    if (favErrors[editingHobby.id]) setFavErrors((p) => ({ ...p, [editingHobby.id]: "" }));
                  }}
                />
                <FieldError id="fav-note-error" message={favErrors[editingHobby.id]} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </OnboardingFrame>
  );
}

function ChipFor({ hobby, categories, selected, onClick }: { hobby: HobbyItem; categories: HobbyCategoryItem[]; selected: boolean; onClick: () => void }) {
  const cat = categoryOf(categories, hobby.categoryId);
  return (
    <HobbyChip
      label={hobby.name}
      category={cat ? uiCategorySlug(cat.slug) : undefined}
      glyph="none"
      selected={selected}
      data-testid={`hobby-chip-${hobby.slug}`}
      onClick={onClick}
      className={cn(selected && "ring-1 ring-primary")}
    />
  );
}

function clampIntensity(n: number): Intensity {
  return (Math.min(5, Math.max(1, Math.round(n))) || 2) as Intensity;
}
