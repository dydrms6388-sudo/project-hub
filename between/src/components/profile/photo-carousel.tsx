"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ProfilePhoto } from "./photo";

export function PhotoCarousel({ photos, name, seed }: { photos: string[]; name: string; seed: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const list = photos.length ? photos : [null];

  const onScroll = () => {
    const el = ref.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="relative overflow-hidden md:rounded-b-3xl">
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex aspect-[4/5] max-h-[72dvh] w-full snap-x snap-mandatory overflow-x-auto"
        aria-label={`${name} 사진 ${list.length}장`}
      >
        {list.map((id, i) => (
          <div key={id ?? i} className="relative h-full w-full shrink-0 snap-center">
            <ProfilePhoto photoId={id} name={name} seed={seed} priority={i === 0} className="size-full text-7xl" />
          </div>
        ))}
      </div>
      <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent" />
      {list.length > 1 && (
        <div className="absolute inset-x-0 top-[max(env(safe-area-inset-top),8px)] flex gap-1 px-16">
          {list.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i === index ? "bg-white" : "bg-white/35")} />
          ))}
        </div>
      )}
    </div>
  );
}
