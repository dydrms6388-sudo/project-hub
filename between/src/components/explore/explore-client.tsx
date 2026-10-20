"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Loader2, SearchX, SlidersHorizontal, X, Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { deleteFilterAction } from "@/app/actions/social";
import { Chip } from "@/components/app/chips";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { ProfileGridCard, ProfileListRow } from "@/components/profile/profile-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filtersToSearchParams,
  parseFiltersLenient,
  type ExploreFilters,
} from "@/lib/explore/filters";
import type { ProfileCard, SavedFilter } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilterSheet } from "./filter-sheet";
import { SortSelect } from "./sort-select";

const noopSubscribe = () => () => {};

type Page = { items: ProfileCard[]; nextOffset: number | null };

async function fetchPage(qs: string, offset: number): Promise<Page> {
  const sp = new URLSearchParams(qs);
  sp.set("offset", String(offset));
  const res = await fetch(`/api/explore?${sp}`, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "목록을 불러오지 못했어요.");
  return body as Page;
}

export function ExploreClient({
  filters,
  initial,
  savedFilters,
}: {
  filters: ExploreFilters;
  initial: Page;
  savedFilters: SavedFilter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigating, startTransition] = useTransition();
  const mode = useViewMode((s) => s.mode);
  const setMode = useViewMode((s) => s.setMode);
  // zustand persist 는 클라이언트에서만 복원되므로 hydration 이후에만 저장값을 사용
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const view = hydrated ? mode : "grid";

  const qs = useMemo(() => filtersToSearchParams(filters).toString(), [filters]);

  const query = useInfiniteQuery({
    queryKey: ["explore", qs],
    queryFn: ({ pageParam }) => fetchPage(qs, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    initialData: { pages: [initial], pageParams: [0] },
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap((p) => p.items).filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [query.data]);

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const apply = (f: ExploreFilters) => {
    const s = filtersToSearchParams(f).toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const count = activeFilterCount(filters);
  const nowOn = filters.availability.length === 1 && filters.availability[0] === "now";
  const onlineOn = filters.activeWithin === "online";

  const removeSaved = async (id: string, name: string) => {
    const r = await deleteFilterAction(id);
    if (!r.ok) return toast.error(r.error);
    toast.success(`'${name}' 필터를 삭제했어요.`);
    router.refresh();
  };

  return (
    <div>
      <PageHeader title={<span className="text-brand">탐색</span>}>
        <SortSelect value={filters.sort} onChange={(sort) => apply({ ...filters, sort })} />
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label={view === "grid" ? "리스트로 보기" : "그리드로 보기"}
          data-testid="view-toggle"
          onClick={() => setMode(view === "grid" ? "list" : "grid")}
        >
          {view === "grid" ? <List /> : <LayoutGrid />}
        </Button>
        <FilterSheet
          value={filters}
          onApply={apply}
          onSaved={() => router.refresh()}
          trigger={
            <Button
              variant="secondary"
              size="sm"
              className="relative rounded-full"
              data-testid="filter-button"
              aria-label={`상세 필터${count ? ` (${count}개 적용 중)` : ""}`}
            >
              <SlidersHorizontal />
              필터
              {count > 0 && (
                <span className="ml-0.5 rounded-full bg-brand px-1.5 text-[10px] leading-4 font-bold text-white">
                  {count}
                </span>
              )}
            </Button>
          }
        />
      </PageHeader>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip
          size="sm"
          selected={nowOn}
          data-testid="quick-now"
          onClick={() => apply({ ...filters, availability: nowOn ? [] : ["now"] })}
        >
          <Zap className="size-3.5" /> 지금 가능
        </Chip>
        <Chip size="sm" selected={onlineOn} onClick={() => apply({ ...filters, activeWithin: onlineOn ? "any" : "online" })}>
          접속 중
        </Chip>
        <Chip size="sm" selected={filters.hasPhoto} onClick={() => apply({ ...filters, hasPhoto: !filters.hasPhoto })}>
          사진 있음
        </Chip>
        {savedFilters.map((s) => (
          <span key={s.id} className="inline-flex shrink-0 items-center">
            <Chip
              size="sm"
              className="rounded-r-none pr-2"
              onClick={() => apply(parseFiltersLenient(s.filters))}
              aria-label={`저장된 필터 ${s.name} 적용`}
            >
              {s.name}
            </Chip>
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-r-full border border-l-0 border-white/10 bg-secondary/60 px-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => removeSaved(s.id, s.name)}
              aria-label={`저장된 필터 ${s.name} 삭제`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {count > 0 && (
          <Chip size="sm" onClick={() => apply({ ...DEFAULT_FILTERS, sort: filters.sort })}>
            <X className="size-3.5" /> 초기화
          </Chip>
        )}
      </div>

      <div className={cn("transition-opacity", navigating && "opacity-60")} aria-busy={navigating}>
        {query.isError && items.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="목록을 불러오지 못했어요"
            description={(query.error as Error).message}
            action={<Button onClick={() => query.refetch()}>다시 시도</Button>}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="조건에 맞는 사람이 아직 없어요"
            description="지역이나 조건을 넓혀 보세요. 비공개로 설정된 정보는 필터에 걸리지 않아요."
            action={
              count > 0 ? (
                <Button onClick={() => apply({ ...DEFAULT_FILTERS, sort: filters.sort })} data-testid="empty-reset">
                  필터 초기화
                </Button>
              ) : undefined
            }
          />
        ) : view === "grid" ? (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="explore-grid">
            {items.map((p, i) => (
              <li key={p.id}>
                <ProfileGridCard p={p} priority={i < 6} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2" data-testid="explore-list">
            {items.map((p) => (
              <li key={p.id}>
                <ProfileListRow p={p} />
              </li>
            ))}
          </ul>
        )}

        {isFetchingNextPage && (
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        )}
        {query.isError && items.length > 0 && (
          <div className="mt-4 text-center">
            <Button variant="secondary" size="sm" onClick={() => fetchNextPage()}>
              더 불러오기 다시 시도
            </Button>
          </div>
        )}
        <div ref={sentinel} aria-hidden className="h-8" />
        {!hasNextPage && items.length > 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {isFetchingNextPage ? <Loader2 className="mx-auto size-4 animate-spin" /> : "모두 확인했어요"}
          </p>
        )}
      </div>
    </div>
  );
}
