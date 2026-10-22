import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/start/onboarding-form";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getMyProfile } from "@/lib/server/repo";
import { maxAdultBirthYear } from "@/lib/validation/profile";

export const metadata: Metadata = { title: "시작하기" };

export default async function StartPage() {
  const session = await getSession();
  if (session) {
    const profile = await withUser(session.claims, (db) => getMyProfile(db, session.userId));
    if (profile) redirect("/explore");
  }
  return (
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10">
      <section className="relative mt-10 mb-8 text-center">
        <div className="bg-primary/25 pointer-events-none absolute -top-16 left-1/2 size-64 -translate-x-1/2 rounded-full blur-3xl" />
        <p className="text-brand relative text-[42px] font-black tracking-[0.18em]">BETWEEN</p>
        <p className="text-muted-foreground relative mt-2 text-sm">우리 사이, 가까운 곳에서</p>
      </section>
      <OnboardingForm maxYear={maxAdultBirthYear()} />
    </main>
  );
}
