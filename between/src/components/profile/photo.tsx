import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-violet-600/80 to-fuchsia-500/70",
  "from-indigo-600/80 to-pink-500/70",
  "from-purple-700/80 to-rose-500/70",
  "from-fuchsia-700/80 to-violet-500/70",
  "from-slate-700 to-violet-600/70",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 프로필 사진. 사진은 항상 권한 검사 라우트(/api/photos/:id)로만 불러온다 */
export function ProfilePhoto({
  photoId,
  name,
  seed,
  className,
  priority,
  sizes,
}: {
  photoId: string | null;
  name: string;
  seed: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!photoId) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br text-4xl font-bold text-white/90",
          GRADIENTS[hash(seed) % GRADIENTS.length],
          className,
        )}
        aria-label={`${name} 사진 없음`}
        role="img"
      >
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 권한 검사 라우트에서 바로 서빙 (최적화 프록시 캐시 금지)
    <img
      src={`/api/photos/${photoId}`}
      alt={`${name} 프로필 사진`}
      className={cn("object-cover", className)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      sizes={sizes}
    />
  );
}
