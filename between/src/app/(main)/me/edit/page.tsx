import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ProfileEditForm } from "@/components/me/profile-edit-form";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "프로필 수정" };

export default async function EditProfilePage() {
  const { profile } = await requireViewer();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Link href="/me" aria-label="뒤로" className="-ml-2 flex size-9 items-center justify-center rounded-full hover:bg-secondary">
              <ChevronLeft className="size-6" />
            </Link>
            프로필 수정
          </span>
        }
      />
      <ProfileEditForm profile={profile} />
    </div>
  );
}
