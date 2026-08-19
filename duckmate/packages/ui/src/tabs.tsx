"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Tabs — 컨텍스트 기반. 모드 전환(친구/데이팅), 프로필 편집 섹션 등에 사용.
 * 키보드: ←/→/Home/End 로 탭 이동 + 즉시 선택 (roving tabindex).
 */
interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  idBase: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(caller: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`${caller}은(는) <Tabs> 안에서만 사용할 수 있어요.`);
  return ctx;
}

export interface TabsProps {
  /** 비제어 초기값 */
  defaultValue: string;
  /** 제어 모드 값 (지정 시 defaultValue 무시) */
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const idBase = React.useId();
  const current = value ?? inner;

  const setValue = React.useCallback(
    (v: string) => {
      setInner(v);
      onValueChange?.(v);
    },
    [onValueChange],
  );

  const ctx = React.useMemo(
    () => ({ value: current, setValue, idBase }),
    [current, setValue, idBase],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function TabList({ children, className, ...aria }: TabListProps) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 || tabs.length === 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      const target = tabs[next];
      target?.focus();
      target?.click();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={aria["aria-label"]}
      onKeyDown={onKeyDown}
      className={cn(
        "flex gap-1 rounded-full border border-line bg-surface-raised p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Tab({ value, children, className, disabled }: TabProps) {
  const ctx = useTabsContext("Tab");
  const selected = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.idBase}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${ctx.idBase}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "flex-1 rounded-full px-4 py-2 text-body-sm font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        selected ? "bg-primary text-primary-fg" : "text-ink-muted hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const ctx = useTabsContext("TabPanel");
  const selected = ctx.value === value;
  return (
    <div
      role="tabpanel"
      id={`${ctx.idBase}-panel-${value}`}
      aria-labelledby={`${ctx.idBase}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={className}
    >
      {selected ? children : null}
    </div>
  );
}
