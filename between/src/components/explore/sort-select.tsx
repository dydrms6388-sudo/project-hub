"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SORTS, type Sort } from "@/lib/explore/filters";

export function SortSelect({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Sort)}>
      <SelectTrigger size="sm" className="h-8 rounded-full border-white/10 text-xs" data-testid="sort-select" aria-label="정렬">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SORTS.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
