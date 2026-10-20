import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/server/api";
import { withUser } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { ImageError, MAX_UPLOAD_BYTES, sanitizePhoto } from "@/lib/server/image";
import { insertPhoto, listPhotos } from "@/lib/server/repo";
import { assertSameOrigin, limitUser } from "@/lib/server/request";
import { photoPath, storage } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("사진은 10MB 이하만 올릴 수 있어요.", 413);
    const s = await requireSession();

    // 1) 한도 확인 (짧은 트랜잭션 — 레이트리밋 카운트는 실패한 업로드에도 남는다)
    await withUser(s.claims, async (db) => {
      await limitUser(db, "photo-upload", 30, 3600);
    });
    const existing = await withUser(s.claims, (db) => listPhotos(db, s.userId));
    if (existing.length >= 5) throw new AppError("사진은 최대 5장까지 올릴 수 있어요.");

    // 2) DB 연결을 잡지 않은 상태에서 파싱·정화 (EXIF 제거, 재인코딩)
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("사진 파일을 선택해 주세요.");
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("사진은 10MB 이하만 올릴 수 있어요.", 413);
    let clean;
    try {
      clean = await sanitizePhoto(Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      if (e instanceof ImageError) throw new AppError(e.message);
      throw e;
    }

    // 3) 저장 → 행 생성 (RLS: 본인 폴더 경로만 허용). 실패 시 파일 정리
    const id = randomUUID();
    const path = photoPath(s.userId, id);
    await storage.put(path, clean.data);
    try {
      await withUser(s.claims, (db) =>
        insertPhoto(db, { id, userId: s.userId, path, width: clean.width, height: clean.height, bytes: clean.data.length }),
      );
    } catch (e) {
      await storage.remove([path]);
      throw e;
    }
    return NextResponse.json({ id, width: clean.width, height: clean.height }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
