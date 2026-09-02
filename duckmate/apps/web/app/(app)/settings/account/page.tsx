import { redirect } from "next/navigation";

/** 12_flows 의 `/settings/account`(휴면·탈퇴) 별칭 → E4 확정 라우트 `/settings/data` (권리 5종 한 곳, 07_legal 결정 21) */
export default function SettingsAccountRedirect() {
  redirect("/settings/data");
}
