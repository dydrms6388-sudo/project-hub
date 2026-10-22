"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveFilterAction } from "@/app/actions/social";
import { Chip, ChipGroup } from "@/components/app/chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AVAILABILITY, BODY_TYPES, INTERESTS, POSITIONS, PURPOSES, STYLES } from "@/lib/domain/options";
import { REGIONS, SIDO_LIST } from "@/lib/domain/regions";
import { ACTIVE_WITHIN, DEFAULT_FILTERS, type ExploreFilters } from "@/lib/explore/filters";
import { cn } from "@/lib/utils";

const AGE = [19, 70] as const;
const HEIGHT = [140, 220] as const;
const AVAIL_OPTS = AVAILABILITY.filter((a) => a.value !== "off") as {
  value: ExploreFilters["availability"][number];
  label: string;
}[];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-b border-white/5 py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function FilterSheet({
  value,
  onApply,
  trigger,
  allowSave = true,
  onSaved,
}: {
  value: ExploreFilters;
  onApply: (f: ExploreFilters) => void;
  trigger: React.ReactNode;
  allowSave?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExploreFilters>(value);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);

  const set = <K extends keyof ExploreFilters>(k: K, v: ExploreFilters[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const onOpenChange = (o: boolean) => {
    if (o) {
      setDraft(value);
      setShowSave(false);
    }
    setOpen(o);
  };

  const toggleSido = (sido: string) => {
    setDraft((d) => {
      if (d.sido.includes(sido)) {
        return {
          ...d,
          sido: d.sido.filter((s) => s !== sido),
          sigungu: d.sigungu.filter((s) => !s.startsWith(sido + ":")),
        };
      }
      return { ...d, sido: [...d.sido, sido] };
    });
  };
  const toggleSigungu = (key: string) =>
    setDraft((d) => ({
      ...d,
      sigungu: d.sigungu.includes(key) ? d.sigungu.filter((s) => s !== key) : [...d.sigungu, key].slice(0, 30),
    }));

  const save = async () => {
    const name = saveName.trim();
    if (!name) return toast.error("필터 이름을 입력해 주세요.");
    setSaving(true);
    const r = await saveFilterAction({ name, filters: draft });
    setSaving(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`'${name}' 필터를 저장했어요.`);
    setSaveName("");
    setShowSave(false);
    onSaved?.();
  };

  const ageVal = [draft.ageMin ?? AGE[0], draft.ageMax ?? AGE[1]];
  const heightVal = [draft.heightMin ?? HEIGHT[0], draft.heightMax ?? HEIGHT[1]];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="bg-popover mx-auto flex max-h-[88dvh] w-full max-w-2xl flex-col gap-0 rounded-t-3xl border-white/10 p-0"
      >
        <SheetHeader className="border-b border-white/5 px-5 pt-4 pb-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" aria-hidden />
          <SheetTitle>상세 필터</SheetTitle>
          <SheetDescription className="text-xs">
            조건끼리는 모두 만족(AND), 한 조건 안의 여러 선택은 하나라도 만족(OR)해요. 비공개로 설정된 정보는 필터에
            걸리지 않아요.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          <Section title="지역" hint="시/도 전체 또는 시/군/구 선택">
            <div className="flex flex-wrap gap-2">
              {SIDO_LIST.map((s) => (
                <Chip key={s} size="sm" selected={draft.sido.includes(s)} onClick={() => toggleSido(s)}>
                  {s}
                </Chip>
              ))}
            </div>
            {draft.sido.map((sido) => (
              <div key={sido} className="bg-secondary/40 space-y-2 rounded-2xl p-3">
                <p className="text-muted-foreground text-xs font-medium">{sido} 세부 지역 (선택 안 하면 전체)</p>
                <div className="flex flex-wrap gap-1.5">
                  {REGIONS[sido].map((g) => {
                    const key = `${sido}:${g}`;
                    return (
                      <Chip
                        key={key}
                        size="sm"
                        selected={draft.sigungu.includes(key)}
                        onClick={() => toggleSigungu(key)}
                      >
                        {g}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            ))}
            <Input
              placeholder="동/읍/면 (선택, 예: 역삼동)"
              value={draft.dong ?? ""}
              maxLength={20}
              onChange={(e) => set("dong", e.target.value.replace(/[^가-힣0-9]/g, "") || undefined)}
              aria-label="동"
            />
          </Section>

          <Section title="나이" hint={`${ageVal[0]}세 ~ ${ageVal[1] === AGE[1] ? `${AGE[1]}세+` : `${ageVal[1]}세`}`}>
            <Slider
              min={AGE[0]}
              max={AGE[1]}
              step={1}
              value={ageVal}
              onValueChange={([a, b]) => {
                set("ageMin", a === AGE[0] ? undefined : a);
                set("ageMax", b === AGE[1] ? undefined : b);
              }}
              aria-label="나이 범위"
              className="py-2"
            />
          </Section>

          <Section
            title="키"
            hint={`${heightVal[0]}cm ~ ${heightVal[1]}cm${draft.heightMin || draft.heightMax ? "" : " (전체)"}`}
          >
            <Slider
              min={HEIGHT[0]}
              max={HEIGHT[1]}
              step={1}
              value={heightVal}
              onValueChange={([a, b]) => {
                set("heightMin", a === HEIGHT[0] ? undefined : a);
                set("heightMax", b === HEIGHT[1] ? undefined : b);
              }}
              aria-label="키 범위"
              className="py-2"
            />
          </Section>

          <Section title="지금 만나기">
            <ChipGroup
              size="sm"
              options={AVAIL_OPTS}
              value={draft.availability}
              onChange={(v) => set("availability", v)}
            />
          </Section>

          <Section title="최근 활동">
            <div
              className="bg-secondary/60 grid grid-cols-4 gap-1 rounded-xl p-1"
              role="radiogroup"
              aria-label="최근 활동"
            >
              {ACTIVE_WITHIN.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.activeWithin === a.value}
                  onClick={() => set("activeWithin", a.value)}
                  className={cn(
                    "h-8 rounded-lg text-xs font-medium transition-colors",
                    draft.activeWithin === a.value ? "bg-brand text-white" : "text-muted-foreground",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="사진">
            <label className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">사진이 있는 프로필만</span>
              <Switch checked={draft.hasPhoto} onCheckedChange={(v) => set("hasPhoto", v)} aria-label="사진 있음" />
            </label>
          </Section>

          <Section title="체형">
            <ChipGroup size="sm" options={BODY_TYPES} value={draft.bodyTypes} onChange={(v) => set("bodyTypes", v)} />
          </Section>
          <Section title="성향" hint="공개 동의한 사람만 표시돼요">
            <ChipGroup
              size="sm"
              options={POSITIONS.filter((p) => p.value !== "undisclosed")}
              value={draft.positions}
              onChange={(v) => set("positions", v)}
            />
          </Section>
          <Section title="외모 스타일">
            <ChipGroup size="sm" options={STYLES} value={draft.styles} onChange={(v) => set("styles", v)} />
          </Section>
          <Section title="만남 목적">
            <ChipGroup size="sm" options={PURPOSES} value={draft.purposes} onChange={(v) => set("purposes", v)} />
          </Section>
          <Section title="관심사">
            <div className="flex gap-1 text-xs">
              {(["any", "all"] as const).map((m) => (
                <Chip key={m} size="sm" selected={draft.interestsMode === m} onClick={() => set("interestsMode", m)}>
                  {m === "any" ? "하나라도 일치" : "모두 일치"}
                </Chip>
              ))}
            </div>
            <ChipGroup size="sm" options={INTERESTS} value={draft.interests} onChange={(v) => set("interests", v)} />
          </Section>

          {allowSave && showSave && (
            <div className="bg-popover sticky bottom-0 flex gap-2 py-3">
              <Input
                autoFocus
                placeholder="필터 이름 (예: 마포 주말)"
                maxLength={20}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                aria-label="필터 이름"
              />
              <Button type="button" onClick={save} disabled={saving} data-testid="filter-save-confirm">
                저장
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-white/5 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <Button
            type="button"
            variant="ghost"
            className="h-12 rounded-xl"
            onClick={() => setDraft({ ...DEFAULT_FILTERS, sort: draft.sort })}
            data-testid="filter-reset"
          >
            초기화
          </Button>
          {allowSave && (
            <Button
              type="button"
              variant="secondary"
              className="h-12 rounded-xl"
              onClick={() => setShowSave((s) => !s)}
              data-testid="filter-save"
            >
              필터 저장
            </Button>
          )}
          <Button
            type="button"
            className="bg-brand h-12 flex-1 rounded-xl text-base font-semibold text-white hover:opacity-90"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            data-testid="filter-apply"
          >
            적용하기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
