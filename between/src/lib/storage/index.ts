import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { supabaseAdmin } from "@/lib/auth/supabase";
import { env } from "@/lib/server/env";

// 사진 저장소. 경로 형식은 항상 "<userId>/<photoId>.webp" (서버 생성) — 사용자 입력이 경로에 섞이지 않는다.
export const BUCKET = "profile-photos";
const PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function photoPath(userId: string, photoId: string) {
  const p = `${userId}/${photoId}.webp`;
  assertPath(p);
  return p;
}

function assertPath(p: string) {
  if (!PATH_RE.test(p)) throw new Error("invalid storage path");
}

function localFile(p: string) {
  assertPath(p);
  const base = resolve(env().LOCAL_STORAGE_DIR);
  const full = resolve(join(base, p));
  if (!full.startsWith(base + "/")) throw new Error("path traversal");
  return full;
}

export type PhotoSource = { kind: "bytes"; data: Buffer } | { kind: "redirect"; url: string };

export const storage = {
  async put(p: string, data: Buffer): Promise<void> {
    if (env().STORAGE_PROVIDER === "supabase") {
      const { error } = await supabaseAdmin()
        .storage.from(BUCKET)
        .upload(p, data, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
      if (error) throw error;
      return;
    }
    const f = localFile(p);
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, data, { flag: "wx" });
  },

  async get(p: string): Promise<PhotoSource | null> {
    if (env().STORAGE_PROVIDER === "supabase") {
      const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(p, 120);
      if (error || !data) return null;
      return { kind: "redirect", url: data.signedUrl };
    }
    try {
      return { kind: "bytes", data: await readFile(localFile(p)) };
    } catch {
      return null;
    }
  },

  async remove(paths: string[]): Promise<void> {
    const valid = paths.filter((p) => PATH_RE.test(p));
    if (!valid.length) return;
    if (env().STORAGE_PROVIDER === "supabase") {
      await supabaseAdmin().storage.from(BUCKET).remove(valid);
      return;
    }
    await Promise.all(valid.map((p) => rm(localFile(p), { force: true })));
  },
};
