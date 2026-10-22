"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { startAction } from "@/app/actions/session";
import { NativeSelect } from "@/components/app/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADULT_NOTICE, PRIVACY_SUMMARY, SENSITIVE_NOTICE } from "@/lib/domain/legal";
import { REGIONS, SIDO_LIST } from "@/lib/domain/regions";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/profile";

export function OnboardingForm({ maxYear }: { maxYear: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      nickname: "",
      birthYear: "" as unknown as number,
      sido: "",
      sigungu: "",
      dong: "",
      adultConfirmed: false as unknown as true,
      privacyConsent: false as unknown as true,
      sensitiveConsent: false as unknown as true,
      website: "",
    },
  });
  const { register, handleSubmit, control, setValue, setError, formState } = form;
  const sido = useWatch({ control, name: "sido" });
  const errors = formState.errors;
  const years = Array.from({ length: maxYear - 1930 + 1 }, (_, i) => maxYear - i);

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const r = await startAction(values);
      if (!r.ok) {
        for (const [k, v] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof OnboardingInput, { message: v });
        toast.error(r.error);
        return;
      }
      router.replace(r.data.redirect);
      router.refresh();
    }),
  );

  const allAgree = () => {
    for (const k of ["adultConfirmed", "privacyConsent", "sensitiveConsent"] as const) {
      setValue(k, true as const, { shouldValidate: true });
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="border-accent/30 bg-accent/10 rounded-2xl border p-4 text-[13px] leading-relaxed">
        <p className="text-accent mb-1 flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="size-4" /> 성인 전용 서비스
        </p>
        <p className="text-foreground/85">{ADULT_NOTICE}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nickname">닉네임</Label>
          <Input
            id="nickname"
            autoComplete="off"
            maxLength={16}
            placeholder="2~16자, 실명 대신 별명을 써 주세요"
            aria-invalid={!!errors.nickname}
            className="h-11 rounded-xl"
            {...register("nickname")}
          />
          {errors.nickname && <p className="text-destructive text-xs">{errors.nickname.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="birthYear">출생연도</Label>
          <NativeSelect id="birthYear" aria-invalid={!!errors.birthYear} {...register("birthYear")}>
            <option value="">선택</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </NativeSelect>
          {errors.birthYear && <p className="text-destructive text-xs">{errors.birthYear.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sido">지역 (시/도)</Label>
            <NativeSelect
              id="sido"
              aria-invalid={!!errors.sido}
              {...register("sido", { onChange: () => setValue("sigungu", "") })}
            >
              <option value="">선택</option>
              {SIDO_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
            {errors.sido && <p className="text-destructive text-xs">{errors.sido.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sigungu">
              시/군/구 <span className="text-muted-foreground">(선택)</span>
            </Label>
            <NativeSelect id="sigungu" disabled={!sido} {...register("sigungu")}>
              <option value="">선택 안 함</option>
              {(REGIONS[sido] ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {/* 봇 방지 허니팟: 화면·스크린리더에서 숨김 */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            website
            <input tabIndex={-1} autoComplete="off" {...register("website")} />
          </label>
        </div>
      </div>

      <fieldset className="bg-card space-y-3 rounded-2xl p-4 ring-1 ring-white/5">
        <legend className="sr-only">필수 동의</legend>
        <button
          type="button"
          onClick={allAgree}
          className="bg-secondary hover:bg-secondary/80 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors"
        >
          모두 동의하기
        </button>
        <ConsentRow
          control={control}
          name="adultConfirmed"
          label="[필수] 만 19세 이상 성인입니다"
          error={errors.adultConfirmed?.message}
        />
        <ConsentRow
          control={control}
          name="privacyConsent"
          label="[필수] 개인정보 수집·이용 동의"
          error={errors.privacyConsent?.message}
          action={
            <Dialog>
              <DialogTrigger className="text-muted-foreground text-xs underline underline-offset-2">보기</DialogTrigger>
              <DialogContent className="max-h-[85dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>개인정보 수집·이용 안내</DialogTitle>
                  <DialogDescription>BETWEEN 은 서비스 제공에 필요한 최소한의 정보만 처리해요.</DialogDescription>
                </DialogHeader>
                <dl className="space-y-3 text-sm">
                  {PRIVACY_SUMMARY.map((s) => (
                    <div key={s.title}>
                      <dt className="font-semibold">{s.title}</dt>
                      <dd className="text-muted-foreground mt-0.5">{s.body}</dd>
                    </div>
                  ))}
                </dl>
                <Link href="/privacy" className="text-primary text-sm underline" target="_blank">
                  개인정보 처리방침 전문
                </Link>
              </DialogContent>
            </Dialog>
          }
        />
        <ConsentRow
          control={control}
          name="sensitiveConsent"
          label="[필수] 민감정보 처리 동의"
          error={errors.sensitiveConsent?.message}
          detail={<p className="text-muted-foreground mt-1 text-xs leading-relaxed">{SENSITIVE_NOTICE}</p>}
        />
      </fieldset>

      <div className="space-y-3">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="bg-brand shadow-primary/30 h-12 w-full rounded-2xl text-base font-bold text-white shadow-lg"
          data-testid="start-submit"
        >
          {pending && <Loader2 className="animate-spin" />}
          익명으로 시작하기
        </Button>
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          가입·이메일·전화번호 없이 이 기기의 익명 세션으로 시작돼요.
          <br />
          세션을 잃으면 복구가 어려우니 시작 후 <b className="text-foreground">내 프로필 → 계정 복구</b>를 설정해
          주세요.
        </p>
        <p className="text-center text-sm">
          <Link href="/restore" className="text-primary underline underline-offset-4">
            이전 계정 복구하기
          </Link>
          <span className="text-muted-foreground mx-2">·</span>
          <Link href="/terms" className="text-muted-foreground underline underline-offset-4">
            이용약관
          </Link>
        </p>
      </div>
    </form>
  );
}

function ConsentRow({
  control,
  name,
  label,
  detail,
  action,
  error,
}: {
  control: ReturnType<typeof useForm<OnboardingInput>>["control"];
  name: "adultConfirmed" | "privacyConsent" | "sensitiveConsent";
  label: string;
  detail?: React.ReactNode;
  action?: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Checkbox
              id={name}
              checked={field.value === true}
              onCheckedChange={(c) => field.onChange(c === true)}
              aria-invalid={!!error}
              className="mt-0.5 size-5"
            />
          )}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={name} className="text-sm leading-snug">
              {label}
            </Label>
            {action}
          </div>
          {detail}
          {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
}
