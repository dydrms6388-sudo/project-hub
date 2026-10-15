"use client";

// =============================================================================
// E1 · 취미 선택 폼
// - 선택: HobbyChip(aria-pressed 제어형) · 최대 5개
// - 몰입도(intensity) 1~5: ①입문 ②관심 ③즐김 ④진심 ⑤덕후 라벨 명시(A2 P2 허들 완화)
// - Top3: rank 1·2·3 을 각각 1개씩 (D2-2 — saveHobbies 가 rank 를 소유)
// - 3개 도달 시 다음 버튼 활성 + "N개 더 고르면 추천이 정확해져요" 유도(강요 아님)
// =============================================================================

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, HobbyChip, Input, Select } from "@duckmate/ui";
import { saveHobbies } from "@/lib/auth/actions";
import {
  messageForActionError,
  redirectForActionError,
} from "@/app/onboarding/_lib/action-errors";

export interface HobbyOption {
  id: string;
  name: string;
  category: string;
  icon: string | null;
}

export interface InitialSelection {
  hobbyId: string;
  intensity: number;
  rank: 1 | 2 | 3 | null;
}

type Rank = 1 | 2 | 3 | null;

interface Picked {
  hobbyId: string;
  intensity: number;
  rank: Rank;
}

const MIN_PICK = 3;
const TARGET_PICK = 5;

const INTENSITY_LABELS: readonly string[] = [
  "① 입문 — 이제 시작했어요",
  "② 관심 — 가끔 즐겨요",
  "③ 즐김 — 꾸준히 즐겨요",
  "④ 진심 — 시간을 많이 써요",
  "⑤ 덕후 — 이건 제 인생이에요",
];

const RANK_LABEL: Record<string, string> = { "1": "1위", "2": "2위", "3": "3위" };

export function HobbiesForm({
  hobbies,
  initial,
}: {
  hobbies: HobbyOption[];
  initial: InitialSelection[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Picked[]>(
    initial.map((i) => ({ hobbyId: i.hobbyId, intensity: i.intensity, rank: i.rank }))
  );
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(hobbies.map((h) => [h.id, h])), [hobbies]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, HobbyOption[]>();
    for (const h of hobbies) {
      if (q && !h.name.toLowerCase().includes(q) && !h.category.toLowerCase().includes(q)) continue;
      const list = map.get(h.category) ?? [];
      list.push(h);
      map.set(h.category, list);
    }
    return [...map.entries()];
  }, [hobbies, query]);

  const usedRanks = new Set(picked.map((p) => p.rank).filter((r): r is 1 | 2 | 3 => r !== null));
  const ranksOk = [1, 2, 3].every((r) => usedRanks.has(r as 1 | 2 | 3));
  const canSubmit = picked.length >= MIN_PICK && ranksOk;
  const remainingToTarget = Math.max(0, TARGET_PICK - picked.length);

  function toggle(hobbyId: string) {
    setError(null);
    setPicked((prev) => {
      const found = prev.find((p) => p.hobbyId === hobbyId);
      if (found) return prev.filter((p) => p.hobbyId !== hobbyId);
      if (prev.length >= TARGET_PICK) {
        setError(`취미는 최대 ${TARGET_PICK}개까지 고를 수 있어요.`);
        return prev;
      }
      const taken = new Set(prev.map((p) => p.rank).filter((r) => r !== null));
      const nextRank = ([1, 2, 3] as const).find((r) => !taken.has(r)) ?? null;
      return [...prev, { hobbyId, intensity: 3, rank: nextRank }];
    });
  }

  function setIntensity(hobbyId: string, intensity: number) {
    setPicked((prev) => prev.map((p) => (p.hobbyId === hobbyId ? { ...p, intensity } : p)));
  }

  function setRank(hobbyId: string, rank: Rank) {
    setPicked((prev) =>
      prev.map((p) => {
        if (p.hobbyId === hobbyId) return { ...p, rank };
        // 같은 순위는 한 취미만 — 기존 보유자는 해제
        if (rank !== null && p.rank === rank) return { ...p, rank: null };
        return p;
      })
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError(
        picked.length < MIN_PICK
          ? `취미를 ${MIN_PICK}개 이상 골라주세요.`
          : "Top3 순위(1·2·3위)를 각각 하나씩 정해주세요."
      );
      return;
    }

    startTransition(async () => {
      const res = await saveHobbies({
        hobbies: picked.map((p) => ({
          hobbyId: p.hobbyId,
          intensity: p.intensity,
          rank: p.rank,
        })),
      });
      if (!res.ok) {
        const to = redirectForActionError(res.code, res.message);
        if (to) {
          router.replace(to);
          return;
        }
        setError(messageForActionError(res.code, res.message));
        return;
      }
      window.dispatchEvent(
        new CustomEvent("duckmate:analytics", {
          detail: { event: "hobby_select_complete", count: picked.length },
        })
      );
      router.replace("/onboarding/quiz");
      router.refresh();
    });
  }

  return (
    <form className="mt-5 flex flex-col gap-5" onSubmit={onSubmit} noValidate data-testid="hobbies-form">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hobby-search" className="text-body-sm font-semibold">
          취미 검색
        </label>
        <Input
          id="hobby-search"
          type="search"
          placeholder="예: 웹툰, 클라이밍"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="hobby-search"
        />
      </div>

      <div className="flex flex-col gap-4" data-testid="hobby-catalog">
        {grouped.length === 0 ? (
          <p className="text-body-sm text-ink-muted">
            검색어와 맞는 태그가 없어요. 다른 단어로 찾아보거나 비슷한 태그를 골라주세요.
          </p>
        ) : (
          grouped.map(([category, list]) => (
            <div key={category} className="flex flex-col gap-2">
              <h2 className="text-h3">{category}</h2>
              <div className="flex flex-wrap gap-2">
                {list.map((h) => (
                  <HobbyChip
                    key={h.id}
                    label={h.icon ? `${h.icon} ${h.name}` : h.name}
                    selected={picked.some((p) => p.hobbyId === h.id)}
                    onClick={() => toggle(h.id)}
                    data-testid={`hobby-chip-${h.id}`}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Card data-testid="hobby-selected">
        <div className="flex items-center justify-between">
          <h2 className="text-h3">고른 취미</h2>
          <Badge variant={picked.length >= MIN_PICK ? "brand" : "neutral"}>
            {picked.length}/{TARGET_PICK}
          </Badge>
        </div>

        {picked.length === 0 ? (
          <p className="mt-2 text-body-sm text-ink-muted">
            위에서 좋아하는 걸 골라주세요. 3개부터 다음으로 넘어갈 수 있어요.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {picked.map((p) => {
              const hobby = byId.get(p.hobbyId);
              return (
                <li key={p.hobbyId} className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body font-semibold">{hobby?.name ?? "취미"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggle(p.hobbyId)}
                      data-testid={`hobby-remove-${p.hobbyId}`}
                    >
                      빼기
                    </Button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`intensity-${p.hobbyId}`} className="text-body-sm">
                      몰입도
                    </label>
                    <Select
                      id={`intensity-${p.hobbyId}`}
                      value={String(p.intensity)}
                      onChange={(e) => setIntensity(p.hobbyId, Number(e.target.value))}
                      data-testid={`hobby-intensity-${p.hobbyId}`}
                    >
                      {INTENSITY_LABELS.map((label, i) => (
                        <option key={label} value={i + 1}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`rank-${p.hobbyId}`} className="text-body-sm">
                      덕질카드 Top3 순위
                    </label>
                    <Select
                      id={`rank-${p.hobbyId}`}
                      value={p.rank === null ? "" : String(p.rank)}
                      onChange={(e) =>
                        setRank(
                          p.hobbyId,
                          e.target.value === "" ? null : (Number(e.target.value) as 1 | 2 | 3)
                        )
                      }
                      data-testid={`hobby-rank-${p.hobbyId}`}
                    >
                      <option value="">순위 없음</option>
                      {(["1", "2", "3"] as const).map((r) => (
                        <option key={r} value={r}>
                          {RANK_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-caption text-ink-muted">
        찾는 태그가 없나요? 검색어를 줄여서 다시 찾아보세요. 새 태그 등록 요청 창구는 준비 중이에요.
      </p>

      <p
        id="hobbies-error"
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
        disabled={!canSubmit}
        aria-describedby="hobbies-error"
        data-testid="hobbies-submit"
      >
        {remainingToTarget > 0 && picked.length >= MIN_PICK
          ? `다음 (${remainingToTarget}개 더 고르면 추천이 정확해져요)`
          : "다음"}
      </Button>
    </form>
  );
}
