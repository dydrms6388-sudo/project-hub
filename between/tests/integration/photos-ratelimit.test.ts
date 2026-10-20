import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { withService } from "@/lib/server/db";
import { sanitizePhoto } from "@/lib/server/image";
import { insertPhoto, listPhotos, makePrimaryPhoto, photoStoragePath, setPhotoVisibility, swipe } from "@/lib/server/repo";
import { photoPath, storage } from "@/lib/storage";
import { as, makeUser } from "../helpers/factory";

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 120, g: 60, b: 200 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestPhone", Model: "X" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 33/1 0/1" } })
    .toBuffer();
}

async function upload(u: { id: string; claims: never } | Awaited<ReturnType<typeof makeUser>>) {
  const clean = await sanitizePhoto(await jpegWithGps());
  const id = randomUUID();
  const path = photoPath(u.id, id);
  await storage.put(path, clean.data);
  await as(u, (db) => insertPhoto(db, { id, userId: u.id, path, width: clean.width, height: clean.height, bytes: clean.data.length }));
  return { id, path, clean };
}

describe("사진 업로드 파이프라인", () => {
  it("EXIF/GPS 메타데이터를 제거하고 WebP 로 재인코딩한다", async () => {
    const original = await jpegWithGps();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const clean = await sanitizePhoto(original);
    const meta = await sharp(clean.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  it("이미지가 아닌 파일, 확장자 위장, 너무 작은 이미지를 거부한다", async () => {
    await expect(sanitizePhoto(Buffer.from("<script>alert(1)</script>"))).rejects.toThrow(/JPG, PNG, WEBP/);
    const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("not really")]);
    await expect(sanitizePhoto(fakeJpeg)).rejects.toThrow(/읽을 수 없어요/);
    const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(sanitizePhoto(tiny)).rejects.toThrow(/너무 작아요/);
  });

  it("업로드 후 저장소에서 읽을 수 있고, 최대 5장으로 제한된다", async () => {
    const u = await makeUser();
    const first = await upload(u);
    const got = await storage.get(first.path);
    expect(got?.kind).toBe("bytes");
    for (let i = 0; i < 4; i++) await upload(u);
    await expect(upload(u)).rejects.toThrow(/PHOTO_LIMIT/);
    expect(await as(u, (db) => listPhotos(db, u.id))).toHaveLength(5);
  });

  it("대표 사진 변경 시 순서가 재정렬된다", async () => {
    const u = await makeUser();
    const p1 = await upload(u);
    const p2 = await upload(u);
    await as(u, (db) => makePrimaryPhoto(db, u.id, p2.id));
    const list = await as(u, (db) => listPhotos(db, u.id));
    expect(list.map((p) => p.id)).toEqual([p2.id, p1.id]);
  });

  it("다른 사람 폴더 경로로 사진 행을 만들 수 없다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const id = randomUUID();
    await expect(
      as(a, (db) => insertPhoto(db, { id, userId: a.id, path: `${b.id}/${id}.webp`, width: 10, height: 10, bytes: 10 })),
    ).rejects.toThrow(/storage_path_owner|row-level security/);
  });

  it("매칭 전용 사진은 매칭 상대에게만 보인다", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const matched = await makeUser();
    const p = await upload(owner);
    await as(owner, (db) => setPhotoVisibility(db, owner.id, p.id, "matches"));
    expect(await as(stranger, (db) => photoStoragePath(db, p.id))).toBeNull();
    await as(owner, (db) => swipe(db, owner.id, matched.id, "like"));
    await as(matched, (db) => swipe(db, matched.id, owner.id, "like"));
    expect(await as(matched, (db) => photoStoragePath(db, p.id))).toBe(p.path);
  });
});

describe("레이트 리밋", () => {
  it("한도를 넘으면 거부하고, 키는 사용자별로 분리된다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const hit = (u: typeof a) =>
      as(u, async (db) => (await db.query("select public.rate_limit_hit('test', 3, 60) as ok")).rows[0].ok as boolean);
    expect([await hit(a), await hit(a), await hit(a), await hit(a)]).toEqual([true, true, true, false]);
    expect(await hit(b)).toBe(true);
  });

  it("purge_expired 는 일반 사용자가 호출할 수 없다", async () => {
    const u = await makeUser();
    await expect(as(u, (db) => db.query("select public.purge_expired()"))).rejects.toThrow(/permission denied/);
    const r = await withService((db) => db.query("select public.purge_expired()"));
    expect(r.rowCount).toBeGreaterThanOrEqual(0);
  });
});
