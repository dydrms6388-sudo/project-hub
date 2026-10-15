/**
 * 증명사진 규격 데이터 — 이 파일 하나가 사이트 전체의 단일 소스다.
 * 규격당 페이지 1개(롱테일)를 만들고, 공통 편집기 컴포넌트에 spec 만 주입한다.
 *
 * ⚠️ 수치 정책
 *  - `verified: true` = 발급 기관의 공식 안내 문구에서 확인한 수치.
 *  - `verified: false` = 공식 고시가 없거나(관행 규격) 출처 간 값이 엇갈려 확정하지 못한 수치.
 *    이 경우 UI 에 "확인 필요" 배지를 띄우고 `verifyNote` 를 그대로 노출한다.
 *  증명사진은 규격이 틀리면 실제로 반려되므로, 확인 못 한 값을 추측으로 채우지 않는다.
 */

export type MmRange = {
  /** 최소 허용치(mm) */
  min: number;
  /** 최대 허용치(mm) */
  max: number;
  /** 가이드 오버레이가 기본으로 맞추는 목표치(mm) */
  target: number;
};

export type PhotoSpec = {
  /** URL slug (= /tools/<slug>/) */
  slug: string;
  /** 규격 이름 (예: "여권 사진") */
  name: string;
  /** 인쇄 크기 (mm) */
  mm: { w: number; h: number };
  /** 화면에 표기할 크기 문구 (인치 규격 등 반올림 표기가 필요한 경우) */
  sizeLabel: string;
  /** 머리 길이(정수리~턱), mm */
  head: MmRange;
  /**
   * 머리 길이가 사진 세로에서 차지하는 비율 (head / mm.h).
   * 값은 buildSpec() 이 head 로부터 계산해 넣는다.
   */
  headRatio: { min: number; max: number; target: number };
  /** 정수리 위 여백(mm). 공식 규정이 없으면 ICAO 9303 권장값을 가이드용으로 쓴다. */
  topMargin: MmRange;
  /**
   * 사진 아래쪽 끝에서 눈높이까지의 거리(mm). 공식 수치가 있는 규격만 채운다.
   * 없으면 null → 가이드 눈높이 선은 머리 위치에서 파생해 그리고 "참고선"으로 표기한다.
   */
  eyeFromBottom: MmRange | null;
  /** 배경색 (CSS/캔버스 색) */
  bgColor: string;
  /** 배경 규정 설명 */
  bgLabel: string;
  /** 규격 유의사항 (UI 체크리스트로 표시) */
  notes: string[];
  /** 공식/근거 출처 */
  source: { label: string; url: string }[];
  /** 공식 출처로 수치를 확인했는가 */
  verified: boolean;
  /** verified=false 일 때 UI 에 노출할 사유 */
  verifyNote?: string;
};

type SpecInput = Omit<PhotoSpec, "headRatio">;

const buildSpec = (s: SpecInput): PhotoSpec => ({
  ...s,
  headRatio: {
    min: s.head.min / s.mm.h,
    max: s.head.max / s.mm.h,
    target: s.head.target / s.mm.h,
  },
});

/* ──────────────────────────────────────────────────────────────────────────
 * 단위 변환 — 인쇄용 300dpi 가 기준
 *   1 inch = 25.4 mm, 300 dpi ⇒ px = mm × 300 / 25.4 = mm × 11.811023…
 *   검산: 35mm → 35 × 300 / 25.4 = 10500 / 25.4 = 413.3858… → 413 px
 *         45mm → 13500 / 25.4 = 531.4961… → 531 px
 *         50.8mm(2인치) → 15240 / 25.4 = 600.0000 → 600 px (정확히 600)
 * ────────────────────────────────────────────────────────────────────────── */

export const DPI = 300;
export const MM_PER_INCH = 25.4;

/** mm → px (지정 dpi, 기본 300dpi). 인쇄 픽셀 수이므로 반올림한다. */
export const mmToPx = (mm: number, dpi: number = DPI): number =>
  Math.round((mm * dpi) / MM_PER_INCH);

/** mm → PDF 포인트 (1pt = 1/72 inch) */
export const mmToPt = (mm: number): number => (mm * 72) / MM_PER_INCH;

/** 규격의 300dpi 출력 픽셀 크기 */
export const specPixels = (spec: PhotoSpec, dpi: number = DPI) => ({
  w: mmToPx(spec.mm.w, dpi),
  h: mmToPx(spec.mm.h, dpi),
});

/* ────────────────────────────── 규격 목록 ────────────────────────────── */

const MOFA_PASSPORT = {
  label: "외교부 여권안내 — 여권 사진 규격",
  url: "https://www.passport.go.kr/home/kor/contents.do?menuPos=32",
};

export const specs: PhotoSpec[] = [
  buildSpec({
    slug: "passport-photo",
    name: "여권 사진",
    mm: { w: 35, h: 45 },
    sizeLabel: "35 × 45 mm (3.5 × 4.5 cm)",
    head: { min: 32, max: 36, target: 34 },
    topMargin: { min: 2, max: 6, target: 4 },
    eyeFromBottom: null,
    bgColor: "#ffffff",
    bgLabel: "균일한 흰색 (그림자·무늬 없음)",
    notes: [
      "최근 6개월 이내에 촬영한 천연색 상반신 정면 사진이어야 합니다.",
      "머리 길이(정수리부터 턱까지)가 32~36mm 범위에 들어야 합니다.",
      "모자·머리띠 등으로 얼굴 윤곽을 가릴 수 없고, 두 귀가 노출되어야 합니다.",
      "안경 착용은 불가합니다. 도수 안경·선글라스 모두 벗고 촬영해야 합니다.",
      "눈은 뜨고 정면을 응시하며, 입은 다물고 무표정에 가까워야 합니다.",
    ],
    source: [MOFA_PASSPORT],
    verified: true,
  }),
  buildSpec({
    slug: "us-visa-photo",
    name: "미국 비자 사진",
    // 원 규격은 2 × 2 인치 = 50.8mm. 국내에서는 51×51mm 로 반올림해 표기한다.
    // 50.8mm 로 두어야 300dpi 에서 정확히 600×600px 이 나온다(미 국무부 디지털 최소 규격).
    mm: { w: 50.8, h: 50.8 },
    sizeLabel: "51 × 51 mm (2 × 2 인치, 300dpi 에서 600 × 600 px)",
    head: { min: 25, max: 35, target: 30 },
    topMargin: { min: 3, max: 10, target: 6 },
    eyeFromBottom: { min: 28, max: 35, target: 31.5 },
    bgColor: "#ffffff",
    bgLabel: "흰색 또는 아이보리색 (무늬 없는 단색)",
    notes: [
      "인화 크기는 2 × 2 인치(51 × 51 mm) 정사각형입니다.",
      "턱 끝부터 정수리까지 머리 길이가 1 ~ 1 3/8 인치(25 ~ 35 mm), 사진 세로의 50~69% 입니다.",
      "사진 아래쪽 끝에서 눈높이까지가 1 1/8 ~ 1 3/8 인치(28 ~ 35 mm) 여야 합니다.",
      "2016년 11월 1일부터 안경 착용 사진은 원칙적으로 불가합니다(의료상 사유는 진단서 필요).",
      "온라인(DS-160) 제출 파일은 정사각형이며 최소 600 × 600 px, 최대 1200 × 1200 px 입니다.",
    ],
    source: [
      {
        label: "U.S. Department of State — Visa Photo Requirements",
        url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html",
      },
      {
        label: "U.S. Department of State — Passport Photos",
        url: "https://travel.state.gov/content/travel/en/passports/how-apply/photos.html",
      },
    ],
    verified: true,
  }),
  buildSpec({
    slug: "license-photo",
    name: "운전면허 사진",
    mm: { w: 35, h: 45 },
    sizeLabel: "35 × 45 mm (350 × 450 px 이상)",
    head: { min: 32, max: 36, target: 34 },
    topMargin: { min: 2, max: 6, target: 4 },
    eyeFromBottom: null,
    bgColor: "#ffffff",
    bgLabel: "흰색 또는 흰색에 가까운 미색 단색",
    notes: [
      "도로교통법 시행규칙에 따라 여권용 사진 규격이 그대로 적용됩니다.",
      "최근 6개월 이내 촬영한 상반신 정면 탈모 사진이어야 합니다.",
      "포토샵 등으로 얼굴을 보정한 사진은 반려될 수 있습니다.",
      "색안경 등으로 눈을 가릴 수 없고, 양쪽 눈썹이 드러나야 합니다.",
      "온라인 신청(e-운전면허)은 별도 픽셀 규격이 있으니 신청 화면 안내를 함께 확인하세요.",
    ],
    source: [
      {
        label: "한국도로교통공단 — 여권용 사진 규격 적용 안내",
        url: "https://www.koroad.or.kr/main/board/9/306204/board_view.do",
      },
      {
        label: "안전운전 통합민원 — 운전면허증 발급 안내",
        url: "https://www.safedriving.or.kr/guide/larGuide011.do?menuCode=MN-PO-1211",
      },
      MOFA_PASSPORT,
    ],
    verified: true,
  }),
  buildSpec({
    slug: "resume-photo",
    name: "이력서 사진",
    mm: { w: 35, h: 45 },
    sizeLabel: "35 × 45 mm (3.5 × 4.5 cm)",
    head: { min: 30, max: 36, target: 33 },
    topMargin: { min: 3, max: 7, target: 5 },
    eyeFromBottom: null,
    bgColor: "#ffffff",
    bgLabel: "흰색 또는 밝은 회색·하늘색 단색",
    notes: [
      "이력서 사진에는 법정 규격이 없습니다. 3.5 × 4.5 cm 와 3 × 4 cm(반명함)가 관행적으로 쓰입니다.",
      "채용 공고나 지원 시스템이 크기·용량을 지정했다면 그 값을 우선하세요.",
      "얼굴이 사진 세로의 2/3 정도를 차지하도록 잡으면 여권 규격과도 호환됩니다.",
      "배경은 단색이면 되고, 흰색이 가장 무난합니다.",
      "블라인드 채용 직무는 사진을 요구하지 않는 경우가 많으니 제출 전에 확인하세요.",
    ],
    source: [
      {
        label: "참고: 외교부 여권 사진 규격 (3.5 × 4.5 cm 근거)",
        url: "https://www.passport.go.kr/home/kor/contents.do?menuPos=32",
      },
    ],
    verified: false,
    verifyNote:
      "이력서 사진은 법령·고시로 정해진 규격이 없습니다. 여기 값은 국내에서 가장 널리 쓰이는 3.5 × 4.5 cm 관행에 맞춘 가이드이며, 제출처가 지정한 규격이 있으면 그 규격을 따르세요.",
  }),
  buildSpec({
    slug: "half-name-card",
    name: "반명함 사진",
    mm: { w: 30, h: 40 },
    sizeLabel: "30 × 40 mm (3 × 4 cm)",
    head: { min: 26, max: 32, target: 29 },
    topMargin: { min: 3, max: 6, target: 4 },
    eyeFromBottom: null,
    bgColor: "#ffffff",
    bgLabel: "흰색 단색",
    notes: [
      "반명함(반명함판)은 3 × 4 cm 를 가리키는 인화소 관행 용어이며 법정 규격이 아닙니다.",
      "각종 자격증 원서, 학원 수강증, 사내 출입증 등에 널리 쓰입니다.",
      "여권·운전면허는 3.5 × 4.5 cm 규격이므로 반명함으로 대체할 수 없습니다.",
      "제출처가 픽셀 단위 규격을 요구하면 300dpi 기준 354 × 472 px 로 맞추면 됩니다.",
      "배경은 흰색 단색으로 두는 것이 가장 안전합니다.",
    ],
    source: [],
    verified: false,
    verifyNote:
      "반명함(3 × 4 cm)은 공식 고시가 없는 관행 규격입니다. 크기는 국내에서 통용되는 값이지만 머리 크기 범위는 규정된 바가 없어 이 도구가 제안하는 가이드값입니다.",
  }),
  buildSpec({
    slug: "student-id-photo",
    name: "학생증 사진",
    mm: { w: 30, h: 40 },
    sizeLabel: "30 × 40 mm (3 × 4 cm)",
    head: { min: 26, max: 32, target: 29 },
    topMargin: { min: 3, max: 6, target: 4 },
    eyeFromBottom: null,
    bgColor: "#ffffff",
    bgLabel: "흰색 단색 (학교가 지정한 색이 있으면 그 색)",
    notes: [
      "학생증 사진 규격은 학교·기관마다 다릅니다. 반드시 소속 기관 공지를 먼저 확인하세요.",
      "가장 흔한 규격은 3 × 4 cm(반명함)와 3.5 × 4.5 cm 입니다.",
      "온라인 제출은 보통 JPG, 300KB~2MB 이하 용량 제한이 붙습니다.",
      "모자·이어폰·과한 액세서리는 대부분의 학교에서 반려 사유입니다.",
      "학생증은 신분 확인용이므로 얼굴이 뚜렷하게 나오는 정면 사진이어야 합니다.",
    ],
    source: [],
    verified: false,
    verifyNote:
      "학생증 사진에는 전국 공통 규격이 없습니다. 여기 값은 가장 흔한 3 × 4 cm 를 기본값으로 둔 것이며, 소속 학교가 안내한 규격을 반드시 확인하세요.",
  }),
  buildSpec({
    slug: "china-visa-photo",
    name: "중국 비자 사진",
    mm: { w: 33, h: 48 },
    sizeLabel: "33 × 48 mm (3.3 × 4.8 cm)",
    head: { min: 28, max: 33, target: 30 },
    topMargin: { min: 3, max: 8, target: 5 },
    eyeFromBottom: null,
    bgColor: "#ffffff",
    bgLabel: "흰색 또는 흰색에 가까운 단색",
    notes: [
      "중국 비자 신청 사진은 33 × 48 mm 규격입니다.",
      "최근 6개월 이내 촬영한 컬러 사진이어야 하며, 눈을 뜨고 입을 다문 정면 사진이어야 합니다.",
      "두 귀가 드러나야 하고, 얼굴 좌우 회전은 20도, 상하 각도는 25도를 넘지 않아야 합니다.",
      "굵은 테·색이 있는·반사되는 안경, 모자, 두건 등은 착용할 수 없습니다.",
      "빛 번짐·그림자 없이 밝기가 적절하고 붉은 눈(적목)이 없어야 합니다.",
    ],
    source: [
      {
        label: "중국비자신청서비스센터(CVASC) — 사진 규격 안내",
        url: "https://www.visaforchina.cn/",
      },
      {
        label: "주광주 중국총영사관 — 중국 비자 신청 사진 규격",
        url: "https://gwangju.china-consulate.gov.cn/kor/lsfwx/visaaffairs/200708/t20070803_5789898.htm",
      },
    ],
    verified: false,
    verifyNote:
      "33 × 48 mm 크기와 촬영 조건은 여러 총영사관 안내에서 일치하지만, 머리 길이·머리 너비 허용 범위는 출처마다 값이 달라(예: 머리 너비 15~22 mm vs 21~24 mm) 확정하지 못했습니다. 신청 전에 접수처 안내를 확인하세요.",
  }),
  buildSpec({
    slug: "japan-visa-photo",
    name: "일본 비자 사진",
    mm: { w: 45, h: 45 },
    sizeLabel: "45 × 45 mm (4.5 × 4.5 cm)",
    head: { min: 25, max: 29, target: 27 },
    topMargin: { min: 5.5, max: 9.5, target: 7.5 },
    eyeFromBottom: null,
    bgColor: "#ffffff",
    bgLabel: "무늬 없는 흰색 배경",
    notes: [
      "일본 비자(査証) 신청 사진은 45 × 45 mm 정사각형입니다.",
      "일본 여권용 사진(45 × 35 mm)과는 다른 규격이므로 혼동하지 마세요.",
      "최근 6개월 이내 촬영, 무표정 정면, 배경은 무늬 없는 흰색이어야 합니다.",
      "온라인(eVisa) 제출 시에는 파일 용량·해상도 제한이 별도로 있습니다.",
      "재외공관(대사관·총영사관)마다 세부 안내가 다를 수 있어 접수처 공지를 확인해야 합니다.",
    ],
    source: [
      {
        label: "일본 외무성 (Ministry of Foreign Affairs of Japan)",
        url: "https://www.mofa.go.jp/j_info/visit/visa/index.html",
      },
    ],
    verified: false,
    verifyNote:
      "45 × 45 mm 크기는 여러 재외공관 안내에서 공통으로 확인되지만, 머리 길이 27 mm(±2 mm)·상단 여백 7.5 mm 는 외무성 원문에서 직접 확인하지 못했습니다. 접수 공관 안내를 확인하세요.",
  }),
];

export const specBySlug = (slug: string): PhotoSpec | undefined =>
  specs.find((s) => s.slug === slug);
