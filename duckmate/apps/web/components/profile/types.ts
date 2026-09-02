import type { Enums, VerifyLevel } from "@duckmate/db";

export type MyHobby = {
  hobbyId: number;
  name: string;
  categorySlug: string;
  rank: number;
  intensity: number;
  favNote: string | null;
};

export type MyPhoto = {
  id: string;
  path: string;
  /** 서명 URL(10분). 생성 실패 시 null → 아바타 폴백 */
  url: string | null;
  isPrimary: boolean;
  reviewStatus: Enums["review_status"];
  rejectCode: Enums["photo_reject_code"] | null;
  createdAt: string;
};

export type PhotoCounts = Record<Enums["review_status"], number>;

/** /me 화면 props (서버 로더 결과). 생년월일 원본·전화 해시는 넣지 않는다 */
export type MyProfileView = {
  profileId: string;
  nickname: string;
  ageBand: string;
  regionLabel: string;
  verifyLevel: VerifyLevel;
  mode: Enums["profile_mode"];
  seekingGender: Enums["seeking_gender"] | null;
  status: Enums["profile_status"];
  bio: string | null;
  nowInto: string | null;
  hobbies: MyHobby[];
  photos: MyPhoto[];
  photoCounts: PhotoCounts;
  hasApprovedPrimary: boolean;
  quizAnswered: number;
  quizTotal: number;
  availabilityCount: number;
  nicknameChangedAt: string | null;
};

export type HobbyOption = { id: number; name: string; categoryId: number; categorySlug: string; categoryName: string };
export type RegionOption = { code: string; sido: string; sigungu: string };
export type QuizQuestionView = { id: number; text: string; options: Array<{ value: number; label: string }> };

/** /me/edit 프리필 */
export type ProfileEditData = {
  profile: {
    nickname: string;
    gender: Enums["gender"] | null;
    regionCode: string | null;
    bio: string | null;
    nowInto: string | null;
    nicknameChangedAt: string | null;
  };
  availability: Array<{ weekday: number; slot: Enums["availability_slot"] }>;
  myHobbies: Array<{ hobbyId: number; rank: number; intensity: number; favNote: string | null }>;
  hobbies: HobbyOption[];
  regions: RegionOption[];
  quiz: { questions: QuizQuestionView[]; answers: Record<number, number> };
};
