import type { ReactNode } from "react";
import { Badge, DuckCard, HobbyAvatar, SuggestionCard, type DuckCardHobby } from "@duckmate/ui";

/**
 * 홈 "서비스 스크린샷 3구역" — 실제 캡처가 아니라 시드 페르소나(서윤·도현·민재·하은) 기준 목업 프레임(13_company_site 결정 19).
 * 실사용자 데이터·실명·연락처 없음. 프레임 하단 "화면 예시" 캡션 고정. 이미지 파일 없음(ui 컴포넌트 렌더).
 */
function Frame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex h-full flex-col">
      <div className="flex-1 rounded-xl border border-border bg-background p-3 shadow-[0_1px_0_0_var(--border)]">
        <div className="mb-2 flex items-center gap-1.5 px-1" aria-hidden="true">
          <span className="size-2 rounded-full bg-sand-300" />
          <span className="size-2 rounded-full bg-sand-300" />
          <span className="size-2 rounded-full bg-sand-300" />
        </div>
        {children}
        <p className="text-caption mt-3 text-center text-muted-foreground">화면 예시</p>
      </div>
      <figcaption className="text-body mt-4 text-foreground">{caption}</figcaption>
    </figure>
  );
}

const SEOYUN_HOBBIES: DuckCardHobby[] = [
  { category: "fandom", label: "콘서트 티켓팅", intensity: 5, overlap: true },
  { category: "cafe", label: "카페투어", intensity: 3, overlap: true },
  { category: "book", label: "독서모임", intensity: 2 },
];

export function MockDuckCard() {
  return (
    <Frame caption="사진보다 먼저 보이는 건 취향이에요. 취미 Top3, 최애, 요즘 빠진 것으로 소개해요.">
      <DuckCard
        profileId="seed-seoyun"
        nickname="서윤"
        ageBand="20대 후반"
        region="마포구"
        verifyLevel={3}
        hobbies={SEOYUN_HOBBIES}
        favorite="밴드 공연 앞자리"
        nowInto="페스티벌 라인업 정주행"
        compat={82}
        reasons={["겹치는 취미 2개", "주말 오전에 같이 움직여요"]}
        availabilityOverlap="주말 아침 같음 · 3칸 겹침"
        sameRegion
        suggestion="이번 달 공연 같이 보기"
      />
    </Frame>
  );
}

export function MockSuggestions() {
  return (
    <Frame caption="매칭되면 '안녕하세요' 대신 '같이 할 것' 세 가지를 먼저 받아요. 하나 고르면 첫 메시지가 돼요.">
      <p className="text-label mb-3 px-1 text-foreground">도현님과 매칭됐어요 · 이걸로 시작해 볼까요?</p>
      <div className="flex flex-col gap-3">
        <SuggestionCard position={1} kind="offline" title="같이 뛰기" body="이번 주말 오전에 한강에서 같이 뛰어볼까요? 5km면 충분해요." selected />
        <SuggestionCard position={2} kind="online" title="플레이리스트 교환" body="요즘 듣는 플레이리스트 하나씩 바꿔 들어봐요." />
        <SuggestionCard position={3} kind="talk" title="최애 이야기" body="최애를 처음 좋아하게 된 계기부터 얘기해요." />
      </div>
    </Frame>
  );
}

const TODAY = [
  { seed: "seed-dohyun", nickname: "도현", category: "fitness", region: "성동구", overlap: 2, hobby: "러닝" },
  { seed: "seed-minjae", nickname: "민재", category: "boardgame", region: "마포구", overlap: 2, hobby: "보드게임" },
  { seed: "seed-haeun", nickname: "하은", category: "photo", region: "서대문구", overlap: 1, hobby: "전시 관람" },
  { seed: "seed-seoyun", nickname: "서윤", category: "fandom", region: "마포구", overlap: 3, hobby: "콘서트" },
];

export function MockDaily() {
  return (
    <Frame caption="매일 07:00, 취미·궁합·활동 시간대로 고른 다섯 명. 무한 스와이프는 없어요.">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-h3">오늘의 5명이에요</p>
          <p className="text-caption tnum text-muted-foreground">4/5 확인</p>
        </div>
        <p className="text-body-sm mt-1 text-muted-foreground">취미가 겹치는 순서예요.</p>
        <ul className="mt-4 divide-y divide-border">
          {TODAY.map((p) => (
            <li key={p.seed} className="flex items-center gap-3 py-3">
              <HobbyAvatar seed={p.seed} category={p.category} size="md" name={`${p.nickname} 아바타`} />
              <div className="min-w-0 flex-1">
                <p className="text-body text-foreground">
                  {p.nickname} <span className="text-body-sm text-muted-foreground">· {p.region}</span>
                </p>
                <p className="text-body-sm truncate text-muted-foreground">{p.hobby}</p>
              </div>
              <Badge variant="accent" size="sm">
                <span className="tnum">겹침 {p.overlap}</span>
              </Badge>
            </li>
          ))}
        </ul>
        <p className="text-caption tnum mt-3 text-muted-foreground">남은 1명 · 내일 07:00에 새 추천이 와요</p>
      </div>
    </Frame>
  );
}
