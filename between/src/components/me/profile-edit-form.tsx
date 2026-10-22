"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type Path, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/actions/profile";
import { ChipGroup } from "@/components/app/chips";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVE_TIMES,
  BODY_TYPES,
  DRINKING,
  EXPIRY_CHOICES,
  INTERESTS,
  isFieldPublic,
  PERSONALITIES,
  POSITIONS,
  PURPOSES,
  SMOKING,
  STYLES,
  VISIBILITY_FIELDS,
  type VisibilityField,
} from "@/lib/domain/options";
import { REGIONS, SIDO_LIST } from "@/lib/domain/regions";
import type { MyProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ageFromBirthYear,
  maxAdultBirthYear,
  profileUpdateSchema,
  type ProfileUpdateInput,
} from "@/lib/validation/profile";
import { NativeSelect } from "./native-select";
import { Section } from "./section";

type Vis = "public" | "private";
export type ProfileFormValues = {
  nickname: string;
  birthYear: number;
  sido: string;
  sigungu: string;
  dong: string;
  height: string;
  weight: string;
  bodyType: string;
  position: string;
  styles: string[];
  personality: string[];
  interests: string[];
  purposes: string[];
  activeTimes: string[];
  smoking: string;
  drinking: string;
  bio: string;
  visibility: Record<VisibilityField, Vis>;
  positionConsent: boolean;
  isHidden: boolean;
  expiresInDays: number;
};

function nearestExpiry(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
  const choices = EXPIRY_CHOICES.filter((c) => c.days > 0);
  return choices.reduce((best, c) => (Math.abs(c.days - days) < Math.abs(best.days - days) ? c : best), choices[0])
    .days;
}

export function toFormValues(p: MyProfile): ProfileFormValues {
  const visibility = Object.fromEntries(
    VISIBILITY_FIELDS.map((f) => [f, isFieldPublic(p.field_visibility ?? {}, f) ? "public" : "private"]),
  ) as Record<VisibilityField, Vis>;
  return {
    nickname: p.nickname,
    birthYear: p.birth_year,
    sido: p.sido,
    sigungu: p.sigungu ?? "",
    dong: p.dong ?? "",
    height: p.height?.toString() ?? "",
    weight: p.weight?.toString() ?? "",
    bodyType: p.body_type ?? "",
    position: p.position ?? "",
    styles: p.styles,
    personality: p.personality,
    interests: p.interests,
    purposes: p.purposes,
    activeTimes: p.active_times,
    smoking: p.smoking ?? "",
    drinking: p.drinking ?? "",
    bio: p.bio ?? "",
    visibility,
    positionConsent: !!p.sensitive_consent_at,
    isHidden: p.is_hidden,
    expiresInDays: nearestExpiry(p.expires_at),
  };
}

export function ProfileEditForm({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const form = useForm<ProfileFormValues>({
    defaultValues: toFormValues(profile),
    // 스키마는 입력값을 정규화(coerce/transform)한다. 서버에서도 같은 스키마로 다시 검증한다.
    resolver: zodResolver(profileUpdateSchema) as unknown as Resolver<ProfileFormValues>,
    mode: "onBlur",
  });
  const { register, control, setValue, handleSubmit, setError, formState } = form;
  const errors = formState.errors as Partial<Record<string, { message?: string }>>;
  const sido = useWatch({ control, name: "sido" });
  const consent = useWatch({ control, name: "positionConsent" });
  const bio = useWatch({ control, name: "bio" }) ?? "";
  const thisYear = maxAdultBirthYear();
  const years = Array.from({ length: thisYear - 1930 + 1 }, (_, i) => thisYear - i);

  const onSubmit = handleSubmit(async (values) => {
    const r = await updateProfileAction(values as unknown as ProfileUpdateInput);
    if (!r.ok) {
      if (r.fieldErrors) {
        for (const [k, msg] of Object.entries(r.fieldErrors)) setError(k as Path<ProfileFormValues>, { message: msg });
      }
      toast.error(r.error);
      return;
    }
    toast.success("프로필을 저장했어요.");
    router.push("/me");
    router.refresh();
  });

  const err = (k: string) =>
    errors[k]?.message ? (
      <p role="alert" className="text-destructive mt-1 text-xs">
        {errors[k]?.message}
      </p>
    ) : null;

  const vis = (field: VisibilityField) => (
    <Controller
      control={control}
      name={`visibility.${field}`}
      render={({ field: f }) => <VisToggle value={f.value} onChange={f.onChange} />}
    />
  );

  return (
    <form onSubmit={onSubmit} noValidate className="pb-24">
      <Section title="기본 정보" description="닉네임·나이·시/도는 필수예요. 정확한 주소는 입력하지 마세요.">
        <div className="space-y-4">
          <Field id="nickname" label="닉네임" error={err("nickname")}>
            <Input
              id="nickname"
              maxLength={16}
              autoComplete="off"
              className="h-11 rounded-xl"
              {...register("nickname")}
            />
          </Field>
          <Field id="birthYear" label="출생연도" error={err("birthYear")}>
            <NativeSelect id="birthYear" {...register("birthYear", { valueAsNumber: true })}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년생 ({ageFromBirthYear(y)}세)
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="sido" label="시/도" error={err("sido")}>
              <NativeSelect
                id="sido"
                {...register("sido", {
                  onChange: () => {
                    setValue("sigungu", "");
                    setValue("dong", "");
                  },
                })}
              >
                {SIDO_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="sigungu" label="시/군/구" extra={vis("sigungu")} error={err("sigungu")}>
              <NativeSelect id="sigungu" {...register("sigungu")}>
                <option value="">선택 안 함</option>
                {(REGIONS[sido] ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field id="dong" label="동/읍/면 (선택)" extra={vis("dong")} error={err("dong")}>
            <Input
              id="dong"
              placeholder="예: 역삼동"
              maxLength={20}
              className="h-11 rounded-xl"
              {...register("dong")}
            />
          </Field>
        </div>
      </Section>

      <Section title="신체">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="height" label="키" extra={vis("height")} error={err("height")}>
              <div className="relative">
                <Input
                  id="height"
                  type="number"
                  inputMode="numeric"
                  placeholder="175"
                  className="h-11 rounded-xl pr-10"
                  {...register("height")}
                />
                <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">cm</span>
              </div>
            </Field>
            <Field id="weight" label="몸무게" extra={vis("weight")} error={err("weight")}>
              <div className="relative">
                <Input
                  id="weight"
                  type="number"
                  inputMode="numeric"
                  placeholder="70"
                  className="h-11 rounded-xl pr-10"
                  {...register("weight")}
                />
                <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">kg</span>
              </div>
            </Field>
          </div>
          <ChipField label="체형" extra={vis("body_type")}>
            <SingleChips control={control} name="bodyType" options={BODY_TYPES} label="체형" />
          </ChipField>
        </div>
      </Section>

      <Section
        title="성향 (민감정보)"
        description="성향 정보는 성생활에 관한 민감정보에 해당할 수 있어요. 별도 동의한 경우에만 저장되고, 기본값은 비공개예요. 동의를 철회하면 즉시 삭제돼요."
      >
        <div className="space-y-3">
          <label htmlFor="positionConsent" className="flex items-start gap-3">
            <Controller
              control={control}
              name="positionConsent"
              render={({ field }) => (
                <Checkbox
                  id="positionConsent"
                  checked={field.value}
                  onCheckedChange={(c) => {
                    field.onChange(c === true);
                    if (c !== true) setValue("position", "");
                  }}
                  className="mt-0.5"
                />
              )}
            />
            <span className="text-sm">
              <ShieldCheck className="text-primary mr-1 inline size-4" />
              성향 정보는 민감정보예요. 저장·공개에 별도로 동의합니다
            </span>
          </label>
          {err("positionConsent")}
          {consent && (
            <ChipField label="성향" extra={vis("position")}>
              <SingleChips control={control} name="position" options={POSITIONS} label="성향" />
            </ChipField>
          )}
        </div>
      </Section>

      <Section title="나를 소개해요">
        <div className="space-y-5">
          <ChipField label="외모 스타일 (최대 5개)" extra={vis("styles")}>
            <MultiChips control={control} name="styles" options={STYLES} max={5} label="외모 스타일" />
          </ChipField>
          <ChipField label="성격 (최대 5개)" extra={vis("personality")}>
            <MultiChips control={control} name="personality" options={PERSONALITIES} max={5} label="성격" />
          </ChipField>
          <ChipField label="관심사 (최대 10개)" extra={vis("interests")}>
            <MultiChips control={control} name="interests" options={INTERESTS} max={10} label="관심사" />
          </ChipField>
          <ChipField label="만남 목적" extra={vis("purposes")}>
            <MultiChips control={control} name="purposes" options={PURPOSES} max={8} label="만남 목적" />
          </ChipField>
          <ChipField label="활동 시간대" extra={vis("active_times")}>
            <MultiChips control={control} name="activeTimes" options={ACTIVE_TIMES} max={6} label="활동 시간대" />
          </ChipField>
          <ChipField label="흡연" extra={vis("smoking")}>
            <SingleChips control={control} name="smoking" options={SMOKING} label="흡연" />
          </ChipField>
          <ChipField label="음주" extra={vis("drinking")}>
            <SingleChips control={control} name="drinking" options={DRINKING} label="음주" />
          </ChipField>
          <Field id="bio" label="자기소개" extra={vis("bio")} error={err("bio")}>
            <Textarea
              id="bio"
              rows={5}
              maxLength={500}
              placeholder="취미, 좋아하는 것, 원하는 만남을 자유롭게 적어 주세요."
              className="rounded-xl"
              {...register("bio")}
            />
            <p className="text-muted-foreground mt-1 flex justify-between text-xs">
              <span>전화번호·이메일·링크는 입력할 수 없어요.</span>
              <span>{bio.length}/500</span>
            </p>
          </Field>
        </div>
      </Section>

      <Section
        title="노출 설정"
        id="exposure"
        description="자동 만료를 설정하면 기간이 지난 뒤 프로필이 숨겨지고, 7일 후 모든 정보가 삭제돼요."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label htmlFor="isHidden" className="flex-1 text-sm font-semibold">
              프로필 숨김
            </label>
            <Controller
              control={control}
              name="isHidden"
              render={({ field }) => <Switch id="isHidden" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <Field id="expiresInDays" label="자동 만료" error={err("expiresInDays")}>
            <NativeSelect id="expiresInDays" {...register("expiresInDays", { valueAsNumber: true })}>
              {EXPIRY_CHOICES.map((c) => (
                <option key={c.days} value={c.days}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl px-4 pb-3">
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="bg-brand shadow-primary/30 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white shadow-xl transition-opacity active:opacity-85 disabled:opacity-60"
          data-testid="save-profile"
        >
          {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          저장하기
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  extra,
  error,
  children,
}: {
  id: string;
  label: string;
  extra?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {extra}
      </div>
      {children}
      {error}
    </div>
  );
}

function ChipField({ label, extra, children }: { label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

function VisToggle({ value, onChange }: { value: Vis; onChange: (v: Vis) => void }) {
  const pub = value === "public";
  return (
    <button
      type="button"
      aria-pressed={pub}
      aria-label={pub ? "공개 (눌러서 비공개로)" : "비공개 (눌러서 공개로)"}
      onClick={() => onChange(pub ? "private" : "public")}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors",
        pub ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
      )}
    >
      {pub ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      {pub ? "공개" : "비공개"}
    </button>
  );
}

type Opts = readonly { value: string; label: string }[];
type ArrayName = "styles" | "personality" | "interests" | "purposes" | "activeTimes";
type SingleName = "bodyType" | "position" | "smoking" | "drinking";

function MultiChips({
  control,
  name,
  options,
  max,
  label,
}: {
  control: ReturnType<typeof useForm<ProfileFormValues>>["control"];
  name: ArrayName;
  options: Opts;
  max: number;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChipGroup size="sm" options={options} value={field.value} onChange={field.onChange} max={max} label={label} />
      )}
    />
  );
}

function SingleChips({
  control,
  name,
  options,
  label,
}: {
  control: ReturnType<typeof useForm<ProfileFormValues>>["control"];
  name: SingleName;
  options: Opts;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChipGroup
          size="sm"
          single
          options={options}
          value={field.value ? [field.value] : []}
          onChange={(v) => field.onChange(v[0] ?? "")}
          label={label}
        />
      )}
    />
  );
}
