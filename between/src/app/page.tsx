import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getMyProfile } from "@/lib/server/repo";

export default async function Home() {
  const session = await getSession();
  if (session) {
    const profile = await withUser(session.claims, (db) => getMyProfile(db, session.userId));
    if (profile) redirect("/explore");
  }
  redirect("/start");
}
