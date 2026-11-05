/**
 * @duckmate/ui — 공개 API. 앱은 이 파일과 `@duckmate/ui/styles.css` 만 import 한다.
 * 스타일: `import "@duckmate/ui/styles.css"` (앱 globals.css 에 `@source "../../../packages/ui/src";` 필요)
 */

// lib / tokens
export { cn } from "./lib/cn";
export * from "./tokens";

// 기본 컴포넌트
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { Input, type InputProps } from "./components/input";
export { Textarea, type TextareaProps } from "./components/textarea";
export { Label, type LabelProps } from "./components/label";
export { Checkbox, type CheckboxProps } from "./components/checkbox";
export { RadioGroup, RadioGroupItem, RadioCard, type RadioGroupProps, type RadioGroupItemProps, type RadioCardProps } from "./components/radio-group";
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator } from "./components/select";
export { Switch, type SwitchProps } from "./components/switch";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./components/card";
export {
  Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
  type DialogContentProps,
} from "./components/dialog";
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, type SheetContentProps } from "./components/sheet";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
export { Progress, type ProgressProps } from "./components/progress";
export { Skeleton, SkeletonCard, SkeletonList, SkeletonForm } from "./components/skeleton";
export { ToastProvider, useToast, type ToastOptions, type ToastVariant, type ToastProviderProps } from "./components/toast";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./components/tooltip";
export { Avatar, HobbyAvatar, type AvatarProps, type HobbyAvatarProps, type AvatarSize } from "./components/avatar";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export { Spinner, type SpinnerProps } from "./components/spinner";

// 도메인 컴포넌트
export { DuckCard, type DuckCardProps, type DuckCardHobby, type DuckCardPhoto } from "./components/domain/DuckCard";
export { CompatGauge, type CompatGaugeProps } from "./components/domain/CompatGauge";
export { HobbyChip, type HobbyChipProps } from "./components/domain/HobbyChip";
export { IntensityDots, type IntensityDotsProps } from "./components/domain/IntensityDots";
export { VerifyBadge, type VerifyBadgeProps } from "./components/domain/VerifyBadge";
export { StreakBadge, type StreakBadgeProps } from "./components/domain/StreakBadge";
export { MatchReveal, type MatchRevealProps, type MatchRevealVariant } from "./components/domain/MatchReveal";
export { SuggestionCard, type SuggestionCardProps, type SuggestionKind } from "./components/domain/SuggestionCard";
export { SafetyBanner, type SafetyBannerProps, type SafetyBannerVariant } from "./components/domain/SafetyBanner";
export { OnboardingProgress, ONBOARDING_STEPS, type OnboardingProgressProps } from "./components/domain/OnboardingProgress";
export { AppShell, DEFAULT_APP_TABS, type AppShellProps, type AppTab, type AppTabItem } from "./components/domain/AppShell";
export { LegalFooter, DEFAULT_LEGAL_LINKS, type LegalFooterProps, type LegalCompanyInfo, type LegalLink } from "./components/domain/LegalFooter";

// 데모 (앱 /dev/ui 라우트에서 마운트)
export { DemoGallery } from "./demo/DemoGallery";
