import { getAdminSupabase } from "./supabase/server";

export interface AdminData {
  offline: boolean;
  pending: { id: string; slug: string; title: string; created_at: string }[];
  reportsOpen: number;
  takedowns: {
    id: string;
    target_ref: string;
    contact: string;
    reason: string;
    sla_due_at: string;
    created_at: string;
  }[];
  contactsOpen: number;
  totals: { votes: number; approved: number; indexed: number; ugcPending: number };
  events: Record<string, number>;
  botRatio: number;
}

const EVENT_NAMES = ["view", "vote", "result_view", "share_click", "share_landing", "share_to_vote"];

export async function getAdminData(): Promise<AdminData> {
  const admin = getAdminSupabase();
  const empty: AdminData = {
    offline: true,
    pending: [],
    reportsOpen: 0,
    takedowns: [],
    contactsOpen: 0,
    totals: { votes: 0, approved: 0, indexed: 0, ugcPending: 0 },
    events: {},
    botRatio: 0,
  };
  if (!admin) return empty;

  const [pending, takedowns, reports, contacts, votes, approved, indexed, botRatio] =
    await Promise.all([
      admin
        .from("surveys")
        .select("id, slug, title, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(50),
      admin
        .from("takedown_requests")
        .select("id, target_ref, contact, reason, sla_due_at, created_at")
        .eq("handled", false)
        .order("sla_due_at", { ascending: true })
        .limit(50),
      admin.from("reports").select("id", { count: "exact", head: true }).eq("handled", false),
      admin.from("contact_messages").select("id", { count: "exact", head: true }).eq("handled", false),
      admin.from("votes").select("id", { count: "exact", head: true }),
      admin.from("surveys").select("id", { count: "exact", head: true }).eq("status", "approved"),
      admin.from("surveys").select("id", { count: "exact", head: true }).eq("is_indexed", true),
      admin.rpc("get_bot_ratio"),
    ]);

  const events: Record<string, number> = {};
  await Promise.all(
    EVENT_NAMES.map(async (name) => {
      const { count } = await admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("name", name);
      events[name] = count ?? 0;
    }),
  );

  return {
    offline: false,
    pending: pending.data ?? [],
    reportsOpen: reports.count ?? 0,
    takedowns: takedowns.data ?? [],
    contactsOpen: contacts.count ?? 0,
    totals: {
      votes: votes.count ?? 0,
      approved: approved.count ?? 0,
      indexed: indexed.count ?? 0,
      ugcPending: (pending.data ?? []).length,
    },
    events,
    botRatio: Number(botRatio.data ?? 0),
  };
}
