// 개발용 데모 데이터 (가상 인물). 운영 DB 에는 절대 실행하지 않는다.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const NAMES = ["하늘", "도윤", "서준", "민재", "지호", "태오", "건우", "시우", "우진", "준혁", "로운", "은찬", "한결", "윤호", "다온", "이안", "주원", "선우", "유찬", "도현", "재윤", "현우", "seojun", "Leo", "Min", "JH", "곰돌", "러너", "카페러버", "산책왕", "밤산책", "주말여행", "헬린이", "독서남", "커피한잔", "부산바다", "제주살이", "고양이집사", "운동하는개발자", "음악듣는밤"];
const REGIONS = [
  ["서울", "마포구"], ["서울", "강남구"], ["서울", "용산구"], ["서울", "성동구"], ["서울", "송파구"], ["서울", "종로구"],
  ["서울", "영등포구"], ["경기", "성남시 분당구"], ["경기", "수원시 영통구"], ["경기", "고양시 일산동구"], ["인천", "연수구"],
  ["부산", "해운대구"], ["부산", "수영구"], ["대구", "수성구"], ["대전", "유성구"], ["광주", "서구"], ["제주", "제주시"],
];
const BODY = ["slim", "slender", "average", "toned", "muscular", "chubby", "big"];
const POS = ["top", "bottom", "versatile", "other", "undisclosed"];
const STYLES = ["clean", "cute", "manly", "dandy", "sporty", "street", "glasses", "beard", "tattoo", "bear"];
const PERS = ["calm", "cheerful", "sweet", "funny", "shy", "honest", "thoughtful", "homebody", "outgoing", "introvert"];
const INTS = ["workout", "running", "hiking", "travel", "food", "cafe", "cooking", "movies", "music", "concert", "games", "reading", "art", "photo", "fashion", "pets", "drink", "dance", "swim", "kpop"];
const PURP = ["friend", "dating", "relationship", "chat", "meal", "drink", "workout_buddy", "travel"];
const TIMES = ["morning", "afternoon", "evening", "night", "late_night", "weekend"];
const BIOS = [
  "퇴근하고 한강 러닝하는 거 좋아해요. 같이 뛰실 분!",
  "조용한 카페에서 책 읽는 게 낙이에요. 대화 잘 통하는 분 만나고 싶어요.",
  "맛집 탐방 좋아합니다. 주말에 밥 한 끼 해요 :)",
  "운동 3년차. 건강한 관계 원해요.",
  "여행 사진 찍는 게 취미예요. 다음 여행지 추천해 주세요.",
  "낯은 가리지만 친해지면 말 많아요.",
  "고양이 두 마리랑 살아요. 동물 좋아하시는 분 환영",
  "공연·전시 같이 보러 다닐 친구 찾아요.",
  null,
];

let s = 42;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const some = (a, max) => a.filter(() => rnd() < max / a.length).slice(0, max);

async function avatar(i) {
  const hues = [[124, 58, 237], [219, 39, 119], [79, 70, 229], [192, 38, 211], [37, 99, 235]];
  const [r, g, b] = hues[i % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgb(${r},${g},${b})"/><stop offset="1" stop-color="rgb(20,18,28)"/></linearGradient></defs>
    <rect width="900" height="1200" fill="url(#g)"/>
    <circle cx="450" cy="470" r="170" fill="rgba(255,255,255,0.18)"/>
    <rect x="200" y="690" width="500" height="420" rx="250" fill="rgba(255,255,255,0.14)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

export async function seed(c, root) {
  const dir = resolve(root, process.env.LOCAL_STORAGE_DIR ?? ".data/uploads");
  const year = new Date().getFullYear();
  const existing = await c.query("select count(*)::int as n from public.profiles where nickname like '%' and bio like '%[demo]%'");
  if (existing.rows[0].n > 0) {
    console.log("seed: already seeded");
    return;
  }
  await c.query("begin");
  for (let i = 0; i < NAMES.length; i++) {
    const id = randomUUID();
    const [sido, sigungu] = pick(REGIONS);
    await c.query("insert into auth.users (id, is_anonymous) values ($1, true)", [id]);
    const consent = rnd() < 0.7;
    await c.query(
      `insert into public.profiles (id, nickname, birth_year, sido, sigungu, height, weight, body_type, position, styles,
         personality, interests, bio, purposes, active_times, smoking, drinking, field_visibility, adult_confirmed_at,
         privacy_consent_at, sensitive_consent_at, last_active_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now(), now(), $19,
               now() - ($20 || ' minutes')::interval, now() - ($21 || ' days')::interval)`,
      [
        id, NAMES[i], year - 20 - Math.floor(rnd() * 25), sido, sigungu,
        rnd() < 0.85 ? 165 + Math.floor(rnd() * 25) : null,
        rnd() < 0.6 ? 55 + Math.floor(rnd() * 35) : null,
        pick(BODY), consent ? pick(POS) : null, some(STYLES, 3), some(PERS, 3), some(INTS, 5),
        (pick(BIOS) ?? "반가워요") + " [demo]", some(PURP, 3), some(TIMES, 2),
        pick(["no", "sometimes", "yes"]), pick(["no", "sometimes", "often"]),
        JSON.stringify(consent && rnd() < 0.6 ? { position: "public", weight: "public" } : {}),
        consent ? new Date() : null, Math.floor(rnd() * 60 * 24 * 5), Math.floor(rnd() * 30),
      ],
    );
    const status = rnd() < 0.25 ? "now" : pick(["off", "off", "tonight", "weekend", "flexible"]);
    await c.query(
      `insert into public.activity_status (user_id, status, expires_at) values ($1, $2::public.availability, case when $2::text = 'now' then now() + interval '3 hours' else null end)`,
      [id, status],
    );
    if (rnd() < 0.8) {
      const photoId = randomUUID();
      const path = `${id}/${photoId}.webp`;
      mkdirSync(join(dir, id), { recursive: true });
      const buf = await avatar(i);
      writeFileSync(join(dir, path), buf);
      await c.query(
        `insert into public.profile_photos (id, user_id, storage_path, position, width, height, bytes) values ($1,$2,$3,0,900,1200,$4)`,
        [photoId, id, path, buf.length],
      );
    }
    if (rnd() < 0.5) {
      await c.query(
        `insert into public.contact_methods (user_id, kind, value, visibility) values ($1, 'kakao_openchat', $2, $3)`,
        [id, `https://open.kakao.com/o/demo${i}abcd`, rnd() < 0.3 ? "public" : "matches"],
      );
    }
  }
  await c.query("commit");
  console.log(`seed: ${NAMES.length} demo profiles`);
}
