import type { Availability, ContactKind, Presence, VisibilityField } from "@/lib/domain/options";

export type ProfileCard = {
  id: string;
  nickname: string;
  age: number;
  sido: string;
  sigungu: string | null;
  dong: string | null;
  height: number | null;
  weight: number | null;
  body_type: string | null;
  position: string | null;
  styles: string[];
  personality: string[];
  interests: string[];
  bio: string | null;
  purposes: string[];
  active_times: string[];
  smoking: string | null;
  drinking: string | null;
  availability: Availability;
  presence: Presence;
  is_new: boolean;
  primary_photo_id: string | null;
  photo_count: number;
};

export type MyProfile = {
  id: string;
  nickname: string;
  birth_year: number;
  sido: string;
  sigungu: string | null;
  dong: string | null;
  height: number | null;
  weight: number | null;
  body_type: string | null;
  position: string | null;
  styles: string[];
  personality: string[];
  interests: string[];
  bio: string | null;
  purposes: string[];
  active_times: string[];
  smoking: string | null;
  drinking: string | null;
  field_visibility: Partial<Record<VisibilityField, "public" | "private">>;
  is_hidden: boolean;
  expires_at: string | null;
  status: "active" | "suspended" | "banned";
  suspended_until: string | null;
  sensitive_consent_at: string | null;
  created_at: string;
};

export type Photo = {
  id: string;
  user_id: string;
  position: number;
  width: number;
  height: number;
  visibility: "public" | "matches";
};

export type Contact = {
  id: string;
  user_id: string;
  kind: ContactKind;
  value: string;
  visibility: "public" | "matches";
};

export type MatchItem = { match_id: string; matched_at: string; profile: ProfileCard };
export type LikeItem = { created_at: string; profile: ProfileCard };

export type ActivityStatus = { status: Availability; expires_at: string | null };

export type SavedFilter = { id: string; name: string; filters: Record<string, unknown>; created_at: string };

export type ReportRow = {
  id: string;
  reporter_id: string | null;
  reported_id: string;
  reason: string;
  detail: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
  reported_nickname: string | null;
  reported_status: string | null;
  open_count: number;
};
