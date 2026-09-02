/**
 * photo-review — 사진 업로드 후처리 (D2 · A5 §8)
 *
 * 입력(둘 중 하나):
 *   (a) 서버 액션 functions.invoke: { photo_id }
 *   (b) Storage DB 웹훅(storage.objects INSERT): { type:"INSERT", table:"objects", record:{ bucket_id:"photos", name } }
 * 인증: Authorization Bearer <service role> 또는 x-webhook-secret = PHOTO_REVIEW_WEBHOOK_SECRET
 *
 * 처리:
 *   1. photos 행 조회(pending/held 만) → 원본 다운로드 → 매직바이트 검사
 *   2. 리사이즈 최대 1080px + WebP 재인코딩(EXIF 제거) → {profile_id}/{photo_id}.webp 업로드 → 원본 삭제 → photos.path 갱신
 *      (라이브러리 실패 시 원본 유지 + auto_flags.resized=false, TODO 참고)
 *   3. FaceDetector(none|external) → face_count/face_confidence(참고값) + auto_flags
 *   4. review_status 는 바꾸지 않는다(자동 승인·자동 반려 금지). held 도 그대로. 사람 검수(D8)가 판정.
 *   5. audit_logs(photo_auto_reviewed)
 */
import { adminClient, isTrustedCaller } from "../_shared/supabase.ts";
import { json, preflight } from "../_shared/cors.ts";
import { getFaceDetector, type FaceDetection } from "./lib/face.ts";

const BUCKET = "photos";
const MAX_EDGE = 1080;
const MAX_BYTES = 5 * 1024 * 1024;
const WEBP_QUALITY = 82;

type PhotoRow = { id: string; profile_id: string; path: string; review_status: "pending" | "approved" | "rejected" | "held"; auto_flags: Record<string, unknown> | null };

function sniff(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/**
 * 리사이즈 + WebP 인코딩. ImageScript(순수 wasm, Deno 호환) 사용. 실패 시 null(원본 유지).
 * TODO(D7): Supabase Image Transformation(Pro) 이 가능해지면 이 단계를 스토리지 변환으로 대체 검토.
 */
async function resizeToWebp(bytes: Uint8Array): Promise<{ out: Uint8Array; width: number; height: number } | null> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const decoded = await Image.decode(bytes);
    if (!(decoded instanceof Image)) return null; // GIF 등 애니메이션은 미지원
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
    const img = scale < 1 ? decoded.resize(Math.round(decoded.width * scale), Math.round(decoded.height * scale)) : decoded;
    const out = await img.encodeWEBP(WEBP_QUALITY);
    return { out, width: img.width, height: img.height };
  } catch (e) {
    console.error("[photo-review] resize failed", e instanceof Error ? e.message : e);
    return null;
  }
}

async function resolvePhoto(body: Record<string, unknown>): Promise<PhotoRow | null> {
  const supabase = adminClient();
  let query = supabase.from("photos").select("id, profile_id, path, review_status, auto_flags");
  if (typeof body.photo_id === "string") {
    query = query.eq("id", body.photo_id);
  } else if (body.type === "INSERT" && typeof body.record === "object" && body.record !== null) {
    const rec = body.record as { bucket_id?: string; name?: string };
    if (rec.bucket_id !== BUCKET || typeof rec.name !== "string") return null;
    query = query.eq("path", rec.name);
  } else {
    return null;
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as PhotoRow | null) ?? null;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isTrustedCaller(req, "PHOTO_REVIEW_WEBHOOK_SECRET")) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const supabase = adminClient();
  const photo = await resolvePhoto(body);
  if (!photo) return json({ ok: false, reason: "photo_not_found" }, 404);
  if (photo.review_status === "approved" || photo.review_status === "rejected") {
    return json({ ok: true, skipped: true, reason: `already_${photo.review_status}` });
  }

  // 1. 다운로드 + 검사
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(photo.path);
  if (dlErr || !blob) return json({ ok: false, reason: "download_failed", detail: dlErr?.message }, 502);
  const original = new Uint8Array(await blob.arrayBuffer());
  const flags: Record<string, unknown> = { ...(photo.auto_flags ?? {}), reviewed_at: new Date().toISOString(), original_bytes: original.length };

  const mime = sniff(original);
  if (!mime || original.length > MAX_BYTES) {
    // 형식 불일치/과대: 파일·행 삭제(검수 큐 오염 방지). 사용자에게는 업로드 실패로 보인다.
    await supabase.storage.from(BUCKET).remove([photo.path]);
    await supabase.from("photos").delete().eq("id", photo.id);
    await supabase.from("audit_logs").insert({ actor_role: "service", action: "photo_rejected_invalid_file", target_type: "photo", target_id: photo.id, meta: { mime, bytes: original.length } });
    return json({ ok: false, reason: "invalid_file", mime, bytes: original.length }, 422);
  }
  flags.mime_in = mime;

  // 2. 리사이즈 → webp
  let finalPath = photo.path;
  let bytesForDetect = original;
  let contentType: string = mime;
  const resized = await resizeToWebp(original);
  if (resized) {
    const webpPath = `${photo.profile_id}/${photo.id}.webp`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(webpPath, resized.out, { contentType: "image/webp", upsert: true });
    if (upErr) {
      flags.resized = false;
      flags.resize_error = upErr.message;
    } else {
      if (webpPath !== photo.path) {
        const { error: pathErr } = await supabase.from("photos").update({ path: webpPath }).eq("id", photo.id);
        if (pathErr) {
          // path 갱신 실패 시 원본 유지(webp 는 고아 → D7 정리)
          flags.resized = false;
          flags.resize_error = pathErr.message;
        } else {
          await supabase.storage.from(BUCKET).remove([photo.path]);
          finalPath = webpPath;
        }
      } else {
        finalPath = webpPath;
      }
      if (finalPath === webpPath) {
        flags.resized = true;
        flags.width = resized.width;
        flags.height = resized.height;
        flags.output_bytes = resized.out.length;
        bytesForDetect = resized.out;
        contentType = "image/webp";
      }
    }
  } else {
    flags.resized = false; // TODO: 라이브러리 미지원 형식 — 원본 유지, 사람 검수 시 확인
  }

  // 3. 얼굴 검사 (참고값)
  const detector = getFaceDetector();
  const face: FaceDetection = await detector.detect(bytesForDetect, contentType);
  flags.detector = face.detector;
  flags.face = face.faces < 0 ? "unknown" : face.faces === 0 ? "none" : face.faces === 1 ? "one" : "many";
  if (face.error) flags.face_error = face.error;

  // 4. 참고값 기록. review_status 는 유지(자동 승인·반려 없음)
  const { error: updErr } = await supabase
    .from("photos")
    .update({
      face_count: face.faces < 0 ? null : face.faces,
      face_confidence: face.faces < 0 ? null : Number(face.confidence.toFixed(3)),
      auto_flags: flags,
    })
    .eq("id", photo.id);
  if (updErr) return json({ ok: false, reason: "update_failed", detail: updErr.message }, 500);

  // 5. 감사 로그(내용 없이 참고값만)
  await supabase.from("audit_logs").insert({
    actor_role: "service",
    action: "photo_auto_reviewed",
    target_type: "photo",
    target_id: photo.id,
    meta: { profile_id: photo.profile_id, path: finalPath, face: flags.face, detector: face.detector, resized: flags.resized === true },
  });

  return json({ ok: true, photo_id: photo.id, path: finalPath, review_status: photo.review_status, auto_flags: flags });
});
