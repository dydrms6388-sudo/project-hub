import { redirect } from "next/navigation";

/** 12_flows 의 `/settings/blocks` 별칭 → E4 확정 라우트 `/blocks` */
export default function SettingsBlocksRedirect() {
  redirect("/blocks");
}
