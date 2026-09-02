"use client";

/**
 * DemoGallery — 전 컴포넌트를 한 화면에 나열. Storybook 대체.
 * 앱에서 `app/dev/ui/page.tsx` 가 `<DemoGallery />` 를 마운트한다 (E 그룹, noindex).
 * 서비스명 리터럴 금지 → 데모 카피에서도 SERVICE_NAME 값을 직접 쓰지 않는다.
 */
import * as React from "react";
import { Heart, MessageCircle, Search, Star, X } from "lucide-react";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Textarea } from "../components/textarea";
import { Label } from "../components/label";
import { Checkbox } from "../components/checkbox";
import { RadioGroup, RadioCard } from "../components/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/select";
import { Switch } from "../components/switch";
import { Badge } from "../components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { Progress } from "../components/progress";
import { Skeleton, SkeletonCard, SkeletonList } from "../components/skeleton";
import { ToastProvider, useToast } from "../components/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";
import { Avatar, HobbyAvatar } from "../components/avatar";
import { EmptyState } from "../components/empty-state";
import { Spinner } from "../components/spinner";
import { DuckCard } from "../components/domain/DuckCard";
import { CompatGauge } from "../components/domain/CompatGauge";
import { HobbyChip } from "../components/domain/HobbyChip";
import { IntensityDots } from "../components/domain/IntensityDots";
import { VerifyBadge } from "../components/domain/VerifyBadge";
import { MatchReveal } from "../components/domain/MatchReveal";
import { SuggestionCard } from "../components/domain/SuggestionCard";
import { SafetyBanner } from "../components/domain/SafetyBanner";
import { OnboardingProgress } from "../components/domain/OnboardingProgress";
import { AppShell } from "../components/domain/AppShell";
import { LegalFooter } from "../components/domain/LegalFooter";
import { HOBBY_CATEGORIES, INTENSITY_LABELS, type Intensity, type VerifyLevel } from "../tokens";

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3" aria-labelledby={`sec-${title}`}>
      <div>
        <h2 id={`sec-${title}`} className="text-h2">{title}</h2>
        {note ? <p className="text-body-sm text-muted-foreground">{note}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => toast({ title: "5개까지 고를 수 있어요" })}>기본</Button>
      <Button variant="outline" size="sm" onClick={() => toast({ title: "저장했어요", variant: "success" })}>성공</Button>
      <Button variant="outline" size="sm" onClick={() => toast({ title: "연결이 잠깐 끊겼어요", description: "입력한 내용은 저장해 뒀어요. 다시 시도해 주세요.", variant: "error", action: { label: "다시 시도", onClick: () => {} } })}>오류</Button>
    </div>
  );
}

const SAMPLE_HOBBIES = [
  { category: "fitness", label: "러닝", intensity: 4 as Intensity, overlap: true },
  { category: "boardgame", label: "보드게임", intensity: 4 as Intensity, overlap: true },
  { category: "cafe", label: "카페투어", intensity: 2 as Intensity },
];

export function DemoGallery() {
  const [dark, setDark] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(["fandom"]);
  const [revealKey, setRevealKey] = React.useState(0);
  const [level, setLevel] = React.useState<VerifyLevel>(2);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);

  const toggle = (slug: string) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : prev.length >= 5 ? prev : [...prev, slug]));

  return (
    <ToastProvider>
      <TooltipProvider>
        <div className="mx-auto max-w-lg space-y-10 px-5 py-8">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-h1">UI 데모</h1>
              <p className="text-body-sm text-muted-foreground">@duckmate/ui · 내부 개발용</p>
            </div>
            <label className="flex items-center gap-2 text-label">
              다크
              <Switch checked={dark} onCheckedChange={setDark} aria-label="다크모드" />
            </label>
          </header>

          <Section title="타입 스케일">
            <p className="text-display">display 32/40</p>
            <p className="text-h1">h1 26/34 화면 제목</p>
            <p className="text-h2">h2 22/30 섹션 제목</p>
            <p className="text-h3">h3 18/26 리스트 제목</p>
            <p className="text-body">body 16/24 본문 텍스트예요.</p>
            <p className="text-body-sm text-muted-foreground">body-sm 14/20 보조 설명</p>
            <p className="text-label">label 14/20 폼 라벨</p>
            <p className="text-caption text-muted-foreground">caption 12/16 · <span className="tnum">07:00 · ₩9,900 · 3/10</span></p>
          </Section>

          <Section title="Button" note="코랄(accent) 위 글자는 흰색이 아니라 neutral-900">
            <div className="flex flex-wrap gap-2">
              <Button>시작하기</Button>
              <Button variant="secondary">넘기기</Button>
              <Button variant="accent"><Heart aria-hidden="true" />좋아요</Button>
              <Button variant="outline">다음</Button>
              <Button variant="ghost">나중에 할게요</Button>
              <Button variant="destructive">차단하기</Button>
              <Button variant="link">이미 회원이에요</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">작게</Button>
              <Button size="md">기본</Button>
              <Button size="lg">크게</Button>
              <Button size="icon" variant="outline" aria-label="패스"><X aria-hidden="true" /></Button>
              <Button size="icon" variant="accent" aria-label="좋아요"><Heart aria-hidden="true" /></Button>
              <Button size="icon" aria-label="슈퍼라이크"><Star aria-hidden="true" /></Button>
              <Button loading>보내는 중</Button>
              <Button disabled>비활성</Button>
            </div>
          </Section>

          <Section title="Form">
            <div className="space-y-1.5">
              <Label htmlFor="nick" required hint="2~10자">닉네임</Label>
              <Input id="nick" placeholder="실명이 아니어도 괜찮아요" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nick2">오류 상태</Label>
              <Input id="nick2" invalid defaultValue="010-1234-5678" aria-describedby="nick2-err" />
              <p id="nick2-err" className="text-caption text-[#B02E2E]">연락처처럼 보이는 닉네임은 쓸 수 없어요</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="now">요즘 빠진 것</Label>
              <Textarea id="now" placeholder="컴백 무대 정주행" maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label>지역</Label>
              <Select>
                <SelectTrigger aria-label="시/도"><SelectValue placeholder="시/도" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seoul">서울특별시</SelectItem>
                  <SelectItem value="gyeonggi">경기도</SelectItem>
                  <SelectItem value="incheon">인천광역시</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-body">
              <Checkbox /> [필수] 이용약관에 동의합니다
            </label>
            <RadioGroup defaultValue="a" aria-label="약속 전날, 나는">
              <RadioCard value="a" label="확인 연락을 꼭 한다" />
              <RadioCard value="b" label="정해졌으면 안 해도 된다" />
            </RadioGroup>
            <label className="flex items-center justify-between text-body">
              아침 추천 알림 07:30 <Switch defaultChecked aria-label="아침 추천 알림" />
            </label>
          </Section>

          <Section title="Badge">
            <div className="flex flex-wrap gap-2">
              <Badge>기본</Badge><Badge variant="primary">사진인증</Badge><Badge variant="secondary">입문 환영</Badge>
              <Badge variant="accent">겹침</Badge><Badge variant="outline">outline</Badge><Badge variant="muted">muted</Badge>
              <Badge variant="success">승인</Badge><Badge variant="warning">검수 대기</Badge><Badge variant="danger">반려</Badge><Badge variant="info">안내</Badge>
            </div>
          </Section>

          <Section title="Card / Tabs / Progress">
            <Card>
              <CardHeader>
                <CardTitle>오늘의 추천 <span className="tnum">5</span>명 남음</CardTitle>
                <CardDescription>07:00에 새로 갱신됐어요</CardDescription>
              </CardHeader>
              <CardContent><Button className="w-full">추천 보러 가기</Button></CardContent>
            </Card>
            <Tabs defaultValue="today">
              <TabsList>
                <TabsTrigger value="today">오늘</TabsTrigger>
                <TabsTrigger value="wait">결과 대기</TabsTrigger>
              </TabsList>
              <TabsContent value="today" className="text-body-sm text-muted-foreground">취미가 겹치는 순서예요.</TabsContent>
              <TabsContent value="wait" className="text-body-sm text-muted-foreground">결과 기다리는 중 <span className="tnum">3</span>건</TabsContent>
            </Tabs>
            <Progress value={30} aria-label="퀴즈 진행" />
            <Progress value={80} tone="accent" aria-label="게이지" />
          </Section>

          <Section title="Dialog / Sheet / Toast / Tooltip">
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild><Button variant="outline">차단 확인</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>민재 님을 차단할까요?</DialogTitle>
                    <DialogDescription>서로의 프로필·추천·채팅에 더 이상 보이지 않아요. 상대에게 알림이 가지 않아요.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost">취소</Button>
                    <Button variant="destructive">차단하기</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild><Button variant="outline">몰입도 시트</Button></SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>얼마나 빠져 있어요?</SheetTitle>
                    <SheetDescription>아직 시작 안 했어도 괜찮아요</SheetDescription>
                  </SheetHeader>
                  <RadioGroup defaultValue="2">
                    {([1, 2, 3, 4, 5] as Intensity[]).map((i) => <RadioCard key={i} value={String(i)} label={INTENSITY_LABELS[i]} />)}
                  </RadioGroup>
                </SheetContent>
              </Sheet>
              <Tooltip>
                <TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="슈퍼라이크 안내"><Star aria-hidden="true" /></Button></TooltipTrigger>
                <TooltipContent>이번 주 슈퍼라이크 1개</TooltipContent>
              </Tooltip>
            </div>
            <ToastDemo />
          </Section>

          <Section title="Avatar / HobbyAvatar" note="사진 없으면 취미 기반 결정론적 아바타. 같은 seed = 같은 결과">
            <div className="flex flex-wrap items-end gap-3">
              {HOBBY_CATEGORIES.map((c, i) => <HobbyAvatar key={c.slug} seed={`profile-${i}`} category={c.slug} name={c.label} size="md" />)}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <HobbyAvatar seed="a1" category="fandom" size="sm" glyph="icon" />
              <HobbyAvatar seed="a2" category="fitness" size="lg" glyph="icon" />
              <HobbyAvatar seed="a3" category="photo" size="xl" initial="서" />
              <Avatar src="" seed="a4" category="game" alt="사진 없음 폴백" />
            </div>
          </Section>

          <Section title="Skeleton / Spinner / EmptyState">
            <SkeletonCard />
            <SkeletonList rows={2} />
            <div className="flex items-center gap-4"><Skeleton className="h-4 w-40" /><Spinner size="sm" /><Spinner /><Spinner size="lg" /></div>
            <EmptyState icon={MessageCircle} title="아직 대화가 없어요" description="매칭되면 여기서 바로 시작할 수 있어요. 첫 마디는 제안 카드가 골라 드려요." />
            <EmptyState icon="🎲" title="이 지역엔 아직 사람이 적어요" description="내일 07:00에 다시 추천해요. 그동안 덕질 카드를 다듬어 두면 겹침이 늘어요." action={<Button variant="outline">카드 다듬기</Button>} />
          </Section>

          <Section title="HobbyChip / IntensityDots / VerifyBadge">
            <div className="flex flex-wrap gap-2">
              {HOBBY_CATEGORIES.map((c) => (
                <HobbyChip key={c.slug} label={c.label.split("·")[0] ?? c.label} category={c.slug} selected={selected.includes(c.slug)} onClick={() => toggle(c.slug)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <HobbyChip label="아이돌" category="fandom" rank={1} intensity={4} selected />
              <HobbyChip label="리듬게임" category="game" rank={2} intensity={2} selected />
              <HobbyChip label="러닝" category="fitness" intensity={4} highlighted />
              <HobbyChip label="독서" category="book" glyph="emoji" size="sm" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {([1, 2, 3, 4, 5] as Intensity[]).map((i) => <IntensityDots key={i} value={i} showLabel />)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VerifyBadge level={0} showLow /><VerifyBadge level={1} showLow /><VerifyBadge level={2} /><VerifyBadge level={3} /><VerifyBadge level={3} size="md" iconOnly />
              <span className="text-caption text-muted-foreground">(L0/L1은 showLow 없으면 미렌더)</span>
            </div>
          </Section>

          <Section title="CompatGauge" note="0~39 muted / 40~79 primary / 80~100 accent">
            <CompatGauge value={32} size="sm" />
            <CompatGauge value={64} />
            <CompatGauge value={88} size="lg" />
            <div className="flex gap-3"><CompatGauge value={32} layout="ring" size="sm" /><CompatGauge value={64} layout="ring" /><CompatGauge value={88} layout="ring" size="lg" /></div>
          </Section>

          <Section title="DuckCard" note="PRD §0-28 구성 순서. 사진은 카드 아래">
            <div className="flex items-center gap-2 text-label">
              인증 레벨
              {([2, 3] as VerifyLevel[]).map((l) => <Button key={l} size="sm" variant={level === l ? "default" : "outline"} onClick={() => setLevel(l)}>L{l}</Button>)}
            </div>
            <DuckCard
              profileId="demo-minjae"
              nickname="민재"
              ageBand="30대 초반"
              region="성동구"
              verifyLevel={level}
              hobbies={SAMPLE_HOBBIES}
              favorite="한강 야간 러닝"
              nowInto="10k 준비 중"
              compat={78}
              reasons={["겹치는 취미 2개 · 주말 아침 같음", "같은 구 · 활동 시간 3칸 겹침"]}
              availabilityOverlap="주말 아침 · 3칸 겹침"
              sameRegion
              suggestion="주말 5k"
              onHeaderClick={() => {}}
              footer={<Button variant="outline" className="w-full">사진 보기</Button>}
            />
            <DuckCard profileId="demo-seoyun" nickname="서윤" ageBand="20대 후반" region="마포구" verifyLevel={2} compact
              hobbies={[{ category: "fandom", label: "아이돌", intensity: 4 }, { category: "game", label: "리듬게임", intensity: 2 }, { category: "photo", label: "굿즈 촬영", intensity: 3 }]}
              favorite="○○" nowInto="컴백 무대 정주행" />
          </Section>

          <Section title="MatchReveal (simple)" note="≤1.2s, 건너뛰기, reduce-motion이면 생략">
            <Button variant="outline" size="sm" onClick={() => setRevealKey((k) => k + 1)}>다시 재생</Button>
            <MatchReveal
              key={revealKey}
              left={<DuckCard profileId="me" nickname="나" ageBand="20대 후반" region="마포구" verifyLevel={2} compact hobbies={SAMPLE_HOBBIES.slice(0, 2)} />}
              right={<DuckCard profileId="demo-minjae" nickname="민재" ageBand="30대 초반" region="성동구" verifyLevel={3} compact hobbies={SAMPLE_HOBBIES.slice(0, 2)} />}
              overlapLabels={["러닝", "보드게임"]}
            />
          </Section>

          <Section title="SuggestionCard">
            <div className="flex snap-x gap-3 overflow-x-auto pb-2">
              <SuggestionCard className="w-72 shrink-0 snap-start" position={1} kind="offline" title="같이 뛰기" body="성동구 러닝 코스 추천해 주실 수 있어요? 주말에 같이 뛰어도 좋고요." />
              <SuggestionCard className="w-72 shrink-0 snap-start" position={2} kind="online" title="보드게임 온라인" body="요즘 온라인으로 하는 보드게임 있어요? 같이 한 판 어때요." selected />
              <SuggestionCard className="w-72 shrink-0 snap-start" position={3} kind="talk" title="최애 코스" body="한강 야간 러닝 코스 중에 제일 좋아하는 구간이 어디예요?" />
            </div>
          </Section>

          <Section title="SafetyBanner">
            <SafetyBanner variant="info">연락처·링크는 매칭 3일 후부터 보낼 수 있어요. 상대에게는 [연락처 숨김]으로 보여요.</SafetyBanner>
            <SafetyBanner variant="warn" title="처음 만나는 날, 이렇게 해요." action={{ label: "만남 안전 가이드 전체 보기", onClick: () => {} }} onDismiss={() => {}}>
              사람 많은 공개 장소에서, 낮이나 이른 저녁에 만나요. 친구에게 누구를 어디서 만나는지 알려 두세요.
            </SafetyBanner>
            <SafetyBanner variant="danger" action={{ label: "신고하기", onClick: () => {} }}>
              이 대화에서 금전·투자 관련 표현이 감지됐어요. 매칭 상대에게 돈을 보내거나 투자 앱을 설치하지 마세요.
            </SafetyBanner>
          </Section>

          <Section title="OnboardingProgress">
            <OnboardingProgress current={3} />
            <OnboardingProgress current={6} total={6} />
            <OnboardingProgress current={7} showCount={false} />
          </Section>

          <Section title="AppShell" note="실제 앱은 페이지 전체를 감싼다. 여기선 프레임 안에 축소 렌더">
            <div className="relative h-72 overflow-hidden rounded-lg border border-border">
              <AppShell active="chat" badges={{ chat: 2 }} className="absolute inset-0 min-h-0" mainClassName="p-4" renderLink={(_item, p) => <a href="#" {...p} />}>
                <p className="text-body-sm text-muted-foreground">main 영역</p>
              </AppShell>
            </div>
          </Section>

          <Section title="LegalFooter" note="값 없으면 [TODO_사업자정보] 그대로 노출">
            <LegalFooter company={{ companyName: "{{COMPANY_NAME}}", ceoName: "{{CEO_NAME}}", bizNo: "{{BIZ_NO}}", ecomNo: "{{ECOM_NO}}", address: "{{ADDRESS}}", email: "{{EMAIL}}", privacyOfficer: "{{PRIVACY_OFFICER}}", youthOfficer: "{{YOUTH_OFFICER}}" }} renderLink={(_l, p) => <a href="#" {...p} />} />
            <LegalFooter compact company={{ companyName: "예시상호", ceoName: "홍길동", bizNo: "000-00-00000", ecomNo: "{{ECOM_NO}}", email: "help@example.com" }} />
          </Section>

          <Section title="아이콘 규격" note="24px / 1.75 stroke, 칩 16px / 2 stroke">
            <div className="flex items-center gap-3 text-foreground">
              <Search size={24} strokeWidth={1.75} aria-hidden="true" /><Heart size={24} strokeWidth={1.75} aria-hidden="true" /><Star size={24} strokeWidth={1.75} aria-hidden="true" />
              <Heart size={24} strokeWidth={1.75} className="fill-accent text-accent" aria-label="좋아요 활성" />
              <Star size={24} strokeWidth={1.75} className="fill-primary text-primary" aria-label="슈퍼라이크 활성" />
            </div>
          </Section>
        </div>
      </TooltipProvider>
    </ToastProvider>
  );
}
