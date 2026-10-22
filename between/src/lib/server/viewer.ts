import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSession, type Session } from "@/lib/auth/session";
import type { MyProfile } from "@/lib/types";
import { withUser } from "./db";
import { getMyProfile, touchActivity } from "./repo";

export type ViewerContext = { session: Session; profile: MyProfile };

/** 로그인 + 프로필 필수 페이지용. 없으면 /start 로 */
export const requireViewer = cache(async (): Promise<ViewerContext> => {
  const session = await getSession();
  if (!session) redirect("/start");
  const profile = await withUser(session.claims, async (db) => {
    const p = await getMyProfile(db, session.userId);
    if (p) await touchActivity(db);
    return p;
  });
  if (!profile) redirect("/start");
  return { session, profile };
});

export function isRestricted(p: MyProfile): "banned" | "suspended" | null {
  if (p.status === "banned") return "banned";
  if (p.status === "suspended" && (!p.suspended_until || new Date(p.suspended_until) > new Date())) return "suspended";
  return null;
}
