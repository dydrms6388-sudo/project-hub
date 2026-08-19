"use client";

// =============================================================================
// E4 · 덕질카드 편집 폼 (client)
// - 최애/요즘 빠진 것 = saveDuckCard, Top3 순위 = saveHobbies (D2 액션 재사용).
// - 연락처·SNS 계정 입력은 서버가 CONTACT_INFO_BLOCKED 로 거부 → 그대로 안내.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea } from "@duckmate/ui";
import { saveDuckCard, saveHobbies } from "@/lib/auth/actions";
import type { MyHobby } from "../_lib/queries";

interface Props {
  hobbies: MyHobby[];
  favNote: string;
  currentObsession: string;
}

const RANKS = [1, 2, 3] as const;

export function DuckCardForm({ hobbies, favNote, currentObsession }: Props) {
  const router = useRouter();
  const [fav, setFav] = React.useState(favNote);
  const [obsession, setObsession] = React.useState(currentObsession);
  const [top3, setTop3] = React.useState<string[]>(() =>
    RANKS.map((rank) => hobbies.find((h) => h.rank === rank)?.hobbyId ?? ""),
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const canEditRank = hobbies.length >= 3;
  const rankIds = top3.filter((id) => id !== "");
  const rankValid = !canEditRank || (rankIds.length === 3 && new Set(rankIds).size === 3);

  const setRank = (index: number, hobbyId: string) => {
    setTop3((prev) => prev.map((v, i) => (i === index ? hobbyId : v)));
    setSaved(false);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rankValid) {
      setError("Top3 는 서로 다른 취미 3개를 골라 주세요.");
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);

    const cardResult = await saveDuckCard({
      favNote: fav.trim() === "" ? null : fav.trim(),
      currentObsession: obsession.trim() === "" ? null : obsession.trim(),
    });
    if (!cardResult.ok) {
      setError(cardResult.message);
      setPending(false);
      return;
    }

    if (canEditRank) {
      const payload = hobbies.map((h) => {
        const index = top3.indexOf(h.hobbyId);
        return {
          hobbyId: h.hobbyId,
          intensity: h.intensity,
          rank: index >= 0 ? ((index + 1) as 1 | 2 | 3) : null,
        };
      });
      const rankResult = await saveHobbies({ hobbies: payload });
      if (!rankResult.ok) {
        setError(rankResult.message);
        setPending(false);
        return;
      }
    }

    setPending(false);
    setSaved(true);
    router.refresh();
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      {canEditRank && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-h3">Top 3</legend>
          <p className="text-caption text-ink-muted">
            고른 취미 중 상대에게 먼저 보여줄 순서예요.
          </p>
          {RANKS.map((rank, index) => (
            <label key={rank} className="flex items-center gap-3 text-body-sm">
              <span className="w-12 shrink-0 text-ink-muted">{rank}위</span>
              <Select
                className="flex-1"
                value={top3[index] ?? ""}
                onChange={(e) => setRank(index, e.target.value)}
              >
                <option value="">선택 안 함</option>
                {hobbies.map((h) => (
                  <option key={h.hobbyId} value={h.hobbyId}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </fieldset>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-h3">최애 ✩</span>
        <span className="text-caption text-ink-muted">최애 작품·선수·아티스트 (40자)</span>
        <Input
          value={fav}
          maxLength={40}
          placeholder="예: ○○○ 작가"
          onChange={(e) => {
            setFav(e.target.value);
            setSaved(false);
          }}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-h3">요즘 빠진 것 🔥</span>
        <span className="text-caption text-ink-muted">최근에 푹 빠진 것 (80자)</span>
        <Textarea
          value={obsession}
          maxLength={80}
          rows={3}
          placeholder="예: 신작 정주행 중"
          onChange={(e) => {
            setObsession(e.target.value);
            setSaved(false);
          }}
        />
      </label>

      <p className="text-caption text-ink-muted">
        전화번호·이메일·SNS 계정은 카드에 적을 수 없어요. 연락처는 매칭 후 72시간이 지나고 양쪽 본인인증이
        끝나면 대화에서 열려요.
      </p>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-body-sm text-success">
          저장했어요.
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        저장
      </Button>
    </form>
  );
}
