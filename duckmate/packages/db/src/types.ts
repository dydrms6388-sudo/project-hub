// D1(스키마 에이전트)이 supabase/migrations 확정 후 이 파일의 타입을 채운다.
// supabase gen types 산출물을 붙여넣는 자리 — 그 전까지는 수기 타입을 유지한다.

export type VerifyLevel = 0 | 1 | 2 | 3;
export type ProfileStatus = "active" | "paused" | "banned";
export type ProfileMode = "friend" | "dating";

export interface Profile {
  id: string;
  user_id: string;
  nickname: string;
  birth_year: number;
  gender: "m" | "f" | "n";
  region_code: string;
  bio: string | null;
  verify_level: VerifyLevel;
  status: ProfileStatus;
  mode: ProfileMode;
  last_active_at: string;
  created_at: string;
}
