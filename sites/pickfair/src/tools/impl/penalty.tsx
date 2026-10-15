"use client";

import { useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, NumberInput, Panel, ToolLoading } from "@/components/ui";
import { celebrate } from "@/lib/confetti";
import { parseNames, sanitizeStrings } from "@/lib/names";
import { drawPenalties } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { it: string[]; c: number };

/** 전연령 벌칙 프리셋 30개 — 신체적 부담·비하·음주 소재 없이 구성 */
export const PRESETS: string[] = [
  "애교 3종 세트 하기",
  "좋아하는 노래 한 소절 부르기",
  "옆 사람 칭찬 세 가지 말하기",
  "30초 동안 웃지 않고 버티기",
  "성대모사 하나 하기",
  "팔굽혀펴기 5개",
  "스쿼트 10개",
  "제자리 뛰기 20번",
  "다음 게임 끝날 때까지 존댓말만 쓰기",
  "오늘 찍은 사진 하나 보여주기",
  "3행시 짓기 (주제는 옆 사람이 정하기)",
  "눈 감고 한 발로 10초 서 있기",
  "다음 라운드 심판 맡기",
  "물 한 컵 마시기",
  "좋아하는 음식 10가지 10초 안에 말하기",
  "30초 자기소개 다시 하기",
  "지금 기분을 한 단어로 말하고 이유 설명하기",
  "옆 사람과 하이파이브 하고 응원 한마디",
  "랜덤 플레이 댄스 10초",
  "초성 퀴즈 하나 내기",
  "끝말잇기 다섯 번 이어가기",
  "오늘의 명언 하나 지어서 말하기",
  "옆 사람 부탁 하나 들어주기",
  "다음 판에 자리 바꾸기",
  "웃긴 표정 3초 유지하기",
  "좋아하는 캐릭터 흉내 내기",
  "감사한 일 세 가지 말하기",
  "다음 모임 장소 정해서 공지하기",
  "휴대폰 배경화면 공개하기",
  "다음 판 시작 전에 준비운동 구령 붙이기",
];

const MAX = 100;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const it = sanitizeStrings(o.it, MAX, 60);
  if (!it || it.length < 1) return null;
  const c = Number(o.c);
  if (!Number.isInteger(c) || c < 1 || c > it.length) return null;
  return { it, c };
}

export default function Penalty() {
  const s = useSeedState<D>(validate);
  const [text, setText] = useState(PRESETS.join("\n"));
  const [count, setCount] = useState(1);
  const [err, setErr] = useState("");

  const items = useMemo(() => parseNames(text, MAX).map((v) => v.slice(0, 60)), [text]);
  const d = s.data;
  const picked = useMemo(
    () => (d ? drawPenalties(s.seed, d.it, d.c) : []),
    [d, s.seed],
  );

  function start() {
    setErr("");
    if (items.length < 1) {
      setErr("벌칙을 1개 이상 남겨 주세요.");
      return;
    }
    if (count > items.length) {
      setErr("뽑을 개수가 벌칙 수보다 많습니다.");
      return;
    }
    s.run({ it: items, c: count });
    void celebrate("small");
  }

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <Field
            label={`벌칙 목록 (현재 ${items.length}개)`}
            htmlFor="pn-items"
            hint="전연령용 기본 벌칙 30개가 들어 있습니다. 자유롭게 지우거나 추가하세요."
          >
            <textarea
              id="pn-items"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm leading-relaxed"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-28">
              <Field label="뽑을 개수" htmlFor="pn-c">
                <NumberInput id="pn-c" value={count} min={1} max={20} onChange={setCount} />
              </Field>
            </div>
            <Btn variant="ghost" onClick={() => setText(PRESETS.join("\n"))} ariaLabel="기본 벌칙 목록으로 되돌리기">
              기본값 복원
            </Btn>
          </div>
          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <Btn onClick={start} ariaLabel="벌칙 뽑기">
            벌칙 뽑기
          </Btn>
          <Notice tone="warn">
            벌칙은 재미로만 사용하세요. 참가자가 원치 않거나 신체적·정신적으로 부담이 되는 벌칙은 넣지 말고,
            누군가를 깎아내리는 내용은 피해 주세요.
          </Notice>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-3">
        <ul className="space-y-2" aria-live="polite">
          {picked.map((p, i) => (
            <li
              key={`${p}-${i}`}
              className="pf-pop rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-4 text-center text-lg font-bold text-violet-800"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {p}
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-slate-500">
          벌칙 {d.it.length}개 중 {d.c}개 · seed {s.seed}
        </p>
        <Notice tone="warn">재미용입니다. 참가자 동의 없이 강요하지 마세요.</Notice>
      </Panel>

      <SeedBar s={s} shareTitle="벌칙 뽑기 결과" shareText={`벌칙: ${picked.join(" / ")}`} />
    </div>
  );
}
