"use client";
import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getBrowserSupabase() {
  if (!URL || !ANON) return null;
  return createBrowserClient(URL, ANON);
}
