import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase";

// 로그인 + owners 등록 계정만 통과시키는 게이트.
// RLS가 최종 방어선이고, 이 함수는 미등록 계정에게 빈 화면 대신 명확한 안내를 준다.
export async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: owner } = await supabase
    .from("owners")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owner) redirect("/not-authorized");

  return { supabase, user };
}
