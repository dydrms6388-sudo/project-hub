import { describe, expect, it } from "vitest";
import {
  BANNED_RULES,
  CONTACT_RULES,
  PLACEHOLDER,
  checkProfileText,
  detectBanned,
  maskContacts,
  minorAgeRegex,
  normalizeText,
  scoreMessage,
} from "./safety-rules";

const ids = (text: string) => maskContacts(text).hits.map((h) => h.ruleId);

describe("maskContacts — 우회 표기 (20+)", () => {
  const cases: Array<[string, string, string]> = [
    // [입력, 기대 rule, 마스킹 결과에 남으면 안 되는 조각]
    ["제 번호는 010-1234-5678 이에요", "CT_PHONE", "1234"],
    ["010 1234 5678 로 연락줘", "CT_PHONE", "5678"],
    ["01012345678", "CT_PHONE", "0101"],
    ["010.1234.5678", "CT_PHONE", "1234"],
    ["0 1 0 1 2 3 4 5 6 7 8", "CT_PHONE", "1 2 3 4"],
    ["공일공 일이삼사 오육칠팔", "CT_PHONE", "일이삼사"],
    ["공일공-1234-5678", "CT_PHONE", "1234"],
    ["０１０－１２３４－５６７８", "CT_PHONE", "1234"], // 전각
    ["o1o 1234 5678", "CT_PHONE", "1234"],
    ["010*1234*5678", "CT_PHONE", "5678"],
    ["+82 10 1234 5678", "CT_PHONE", "5678"],
    ["+82-10-1234-5678", "CT_PHONE", "1234"],
    ["010-123-4567", "CT_PHONE", "4567"],
    ["010​1234​5678", "CT_PHONE", "1234"], // zero-width space
    ["카톡 아이디 duck_mate99 추가해", "CT_KAKAO", "duck_mate99"],
    ["카 톡 : duckmate", "CT_KAKAO", "duckmate"],
    ["ㅋㅌ duckmate1", "CT_KAKAO", "duckmate1"],
    ["kakao id duckmate", "CT_KAKAO", "duckmate"],
    ["오픈채팅 open.kakao.com/o/abcdef", "CT_URL", "abcdef"],
    ["인스타 @duck.mate", "CT_INSTA", "duck.mate"],
    ["insta: duckmate_01", "CT_INSTA", "duckmate_01"],
    ["인별은 duck_mate", "CT_INSTA", "duck_mate"],
    ["@duckmate 팔로우해줘", "CT_INSTA", "duckmate"],
    ["텔레 duckmate", "CT_TELEGRAM_LINE", "duckmate"],
    ["telegram @duck_mate", "CT_TELEGRAM_LINE", "duck_mate"],
    ["t.me/duckmate", "CT_URL", "duckmate"],
    ["라인 아이디 duckmate", "CT_TELEGRAM_LINE", "duckmate"],
    ["line id: duckmate", "CT_TELEGRAM_LINE", "duckmate"],
    ["duck@naver.com 으로 메일 줘", "CT_EMAIL", "naver"],
    ["duck 골뱅이 naver 닷 com", "CT_EMAIL", "naver"],
    ["duck (at) gmail (dot) com", "CT_EMAIL", "gmail"],
    ["https://example.com/abc", "CT_URL", "example"],
    ["www.example.co.kr 봐봐", "CT_URL", "example"],
    ["example.com 들어와", "CT_URL", "example"],
    ["bit.ly/abc123", "CT_URL", "abc123"],
    ["국민은행 123456-01-123456", "CT_ACCOUNT", "123456"],
    ["카카오뱅크 3333-01-1234567 로 보내줘", "CT_ACCOUNT", "3333"],
    ["토스 1000-1234-5678-90", "CT_ACCOUNT", "5678"],
  ];
  for (const [input, rule, mustNotRemain] of cases) {
    it(`${rule}: ${JSON.stringify(input)}`, () => {
      const r = maskContacts(input);
      expect(r.hits.map((h) => h.ruleId)).toContain(rule);
      expect(r.masked).not.toContain(mustNotRemain);
      expect(r.masked).toMatch(/\[(연락처|링크|계좌) 숨김\]/);
    });
  }

  it("placeholder 와 접두어 보존", () => {
    expect(maskContacts("번호 010-1234-5678!").masked).toBe(`번호 ${PLACEHOLDER.contact}!`);
    expect(maskContacts("링크 https://a.com/x 봐").masked).toBe(`링크 ${PLACEHOLDER.link} 봐`);
    expect(maskContacts("국민은행 123456-01-123456 입금").masked).toBe(`${PLACEHOLDER.account} 입금`);
  });

  it("여러 히트·span 은 정규화 텍스트 기준", () => {
    const r = maskContacts("010-1234-5678 / duck@naver.com");
    expect(r.hits.map((h) => h.ruleId).sort()).toEqual(["CT_EMAIL", "CT_PHONE"]);
    const src = "010-1234-5678 / duck@naver.com".normalize("NFKC");
    for (const h of r.hits) expect(src.slice(h.span[0], h.span[1])).toBe(h.matched);
  });

  it("placeholder 는 다시 매칭되지 않는다(멱등)", () => {
    const once = maskContacts("010-1234-5678 kakao duckmate").masked;
    const twice = maskContacts(once);
    expect(twice.masked).toBe(once);
    expect(twice.hits).toHaveLength(0);
  });
});

describe("maskContacts — 정상 문장 오탐 0 (10+)", () => {
  const clean = [
    "주말에 같이 뛰어도 될까요? 한강 10k 코스 추천해요",
    "2024년 12월 25일에 콘서트 갔었어요",
    "오늘 아이스 아메리카노 3잔 마셨어요 ㅋㅋ",
    "카톡 프로필 사진 바꾸셨네요",
    "인스타 보다가 시간 다 갔어요",
    "온라인 게임 같이 할래요? 저는 서포터 포지션이에요",
    "가격은 15,000원이고 1시 30분에 만나요",
    "우리 동네 빵집이 진짜 맛있어요, 2층에 있어요",
    "저는 1995년생이고 취미는 보드게임이에요",
    "그 영화 평점 8.5 나왔대요",
    "오후 3시~5시 사이 괜찮아요, 010이 아니라 버스 100번 타고 가요",
    "기업 문화가 좋은 곳으로 이직했어요",
    "big deal 아니에요, 그냥 편하게 해요",
    "텔레비전 보다가 잠들었어요",
  ];
  for (const s of clean) {
    it(`no hit: ${s}`, () => {
      const r = maskContacts(s);
      expect(r.hits).toHaveLength(0);
      expect(r.masked).toBe(s.normalize("NFKC"));
    });
  }
});

describe("normalizeText", () => {
  it("초성·자모·특수문자 정규화", () => {
    expect(normalizeText("ㅅ.ㅂ")).toBe(normalizeText("ㅅㅂ"));
    expect(normalizeText("시 발")).toBe(normalizeText("시발"));
    expect(normalizeText("S.E.X")).toBe("sex");
    expect(normalizeText("$ex")).toBe("sex");
    expect(normalizeText("조 건 만 남")).toBe(normalizeText("조건만남"));
    expect(normalizeText("ㅈ　ㄴ")).toBe(normalizeText("ㅈㄴ"));
  });
  it("종성+초성 은 초성 초성과 다르다 (옷방 ≠ ㅅㅂ)", () => {
    expect(normalizeText("옷방").includes(normalizeText("ㅅㅂ"))).toBe(false);
    expect(normalizeText("ㅅㅂ").includes(normalizeText("ㅅㅂ"))).toBe(true);
  });
});

describe("detectBanned", () => {
  it("카테고리별 hit + 우회 표기", () => {
    expect(detectBanned("조.건.만.남 가능?").map((h) => h.ruleId)).toContain("BW_ADULT_BIZ");
    expect(detectBanned("ㅈㄱㅁㄴ ㄱㄴ?").map((h) => h.ruleId)).toContain("BW_ADULT_BIZ");
    expect(detectBanned("s e x 하자").map((h) => h.ruleId)).toContain("BW_SEXUAL");
    expect(detectBanned("ㅅㅅ 할래").map((h) => h.ruleId)).toContain("BW_SEXUAL");
    expect(detectBanned("너 진짜 한남충이다").map((h) => h.ruleId)).toContain("BW_HATE");
    expect(detectBanned("ㅂㅅ아").map((h) => h.ruleId)).toContain("BW_HATE");
    expect(detectBanned("찾아가서 죽여버린다").map((h) => h.ruleId)).toContain("BW_VIOLENCE");
    expect(detectBanned("떨 판 있어요").map((h) => h.ruleId)).toContain("BW_ILLEGAL");
    expect(detectBanned("급전 필요해서 그런데 30만원만").map((h) => h.ruleId)).toContain("SC_MONEY");
    expect(detectBanned("코인 리딩방 들어와요").map((h) => h.ruleId)).toContain("SC_INVEST");
    expect(detectBanned("해외 파병 중이라 병원비가").map((h) => h.ruleId)).toContain("SC_URGENT");
    expect(detectBanned("카톡으로 얘기하자").map((h) => h.ruleId)).toContain("CT_LURE");
    expect(detectBanned("여기 말고 다른 앱으로 옮기자").map((h) => h.ruleId)).toContain("CT_LURE");
    expect(detectBanned("저 고딩이에요").map((h) => h.ruleId)).toContain("MN_SCHOOL");
    expect(detectBanned("저 17살이에요").map((h) => h.ruleId)).toContain("MN_AGE");
    expect(detectBanned("09년생입니다", { now: new Date("2026-09-02") }).map((h) => h.ruleId)).toContain("MN_AGE");
    expect(detectBanned("미성년자예요").map((h) => h.ruleId)).toContain("MN_AGE");
  });
  it("맥락 제외·오탐", () => {
    expect(detectBanned("고등학교 선생님이에요").map((h) => h.ruleId)).not.toContain("MN_SCHOOL");
    expect(detectBanned("옷방 정리했어요").map((h) => h.ruleId)).not.toContain("BW_HATE");
    expect(detectBanned("오늘 야근했어요")).toHaveLength(0);
    expect(detectBanned("2020년생 조카 봐줬어요", { now: new Date("2026-09-02") }).map((h) => h.ruleId)).not.toContain("MN_SCHOOL");
    expect(detectBanned("30살이에요").map((h) => h.ruleId)).not.toContain("MN_AGE");
    expect(detectBanned("95년생이에요", { now: new Date("2026-09-02") })).toHaveLength(0);
  });
  it("미성년 출생연도는 기준일로 계산", () => {
    expect(minorAgeRegex(new Date("2026-09-02")).source).toContain("07|08|09|10");
    expect(minorAgeRegex(new Date("2030-01-01")).source).toContain("11|12");
  });
  it("사전 규모 (5 핵심 카테고리 20~40개)", () => {
    for (const id of ["BW_SEXUAL", "BW_HATE", "SC_MONEY", "CT_LURE", "MN_SCHOOL"]) {
      const r = BANNED_RULES.find((x) => x.id === id)!;
      expect(r.words.length).toBeGreaterThanOrEqual(20);
      expect(r.words.length).toBeLessThanOrEqual(40);
    }
    expect(CONTACT_RULES.map((r) => r.id)).toEqual(["CT_EMAIL", "CT_URL", "CT_PHONE", "CT_ACCOUNT", "CT_KAKAO", "CT_TELEGRAM_LINE", "CT_INSTA"]);
  });
});

describe("scoreMessage", () => {
  it("연락처 → mask, 점수·배너", () => {
    const r = scoreMessage("010-1234-5678 로 송금해줘");
    expect(r.severity).toBe("warn");
    expect(r.contactHits).toBe(1);
    expect(r.scamScore).toBe(3);
    expect(r.scamBanner).toBe(true);
    expect(r.masked).toContain(PLACEHOLDER.contact);
  });
  it("계좌 → SC_MONEY 동시 hit", () => {
    const r = scoreMessage("신한은행 110-123-456789");
    expect(r.flags.map((f) => f.ruleId)).toEqual(["CT_ACCOUNT", "SC_MONEY"]);
    expect(r.scamScore).toBe(3);
  });
  it("폭력 → critical + THREAT_VIOLENCE", () => {
    const r = scoreMessage("집주소 알아 죽여버린다");
    expect(r.severity).toBe("critical");
    expect(r.autoReport).toBe("THREAT_VIOLENCE");
  });
  it("불법 → hold + OTHER(P0)", () => {
    const r = scoreMessage("몰카 팔아요");
    expect(r.shouldHold).toBe(true);
    expect(r.autoReport).toBe("OTHER");
  });
  it("성인업소 → hold + COMMERCIAL_SPAM", () => {
    const r = scoreMessage("조건만남 30");
    expect(r.shouldHold).toBe(true);
    expect(r.autoReport).toBe("COMMERCIAL_SPAM");
    expect(r.severity).toBe("report");
  });
  it("미성년 → MINOR_SUSPECT", () => {
    expect(scoreMessage("저 16살인데요").autoReport).toBe("MINOR_SUSPECT");
    const school = scoreMessage("고딩이고 야자 끝나고"); // MN_SCHOOL 단독 → warn 만 (2개 룰 동시 hit 또는 MN_AGE 단독이 신고)
    expect(school.autoReport).toBeNull();
    expect(school.severity).toBe("warn");
    expect(scoreMessage("고딩이고 17살").autoReport).toBe("MINOR_SUSPECT");
  });
  it("정상 → none", () => {
    const r = scoreMessage("주말에 같이 뛰어요!");
    expect(r.severity).toBe("none");
    expect(r.flags).toHaveLength(0);
    expect(r.offlineMeeting).toBe(false);
  });
  it("오프라인 만남 배너", () => {
    expect(scoreMessage("토요일에 홍대에서 만나요").offlineMeeting).toBe(true);
  });
});

describe("checkProfileText", () => {
  it("닉네임·bio", () => {
    expect(checkProfileText("서윤")).toEqual({ ok: true });
    expect(checkProfileText("010-1234-5678")).toMatchObject({ ok: false, kind: "contact" });
    expect(checkProfileText("insta: my.handle")).toMatchObject({ ok: false, kind: "contact" });
    expect(checkProfileText("조건 만남 구함")).toMatchObject({ ok: false, kind: "banned" });
  });
});
