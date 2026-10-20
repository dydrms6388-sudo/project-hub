"use client";

import { Copy, KeyRound, Loader2, LogOut, Mail, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccountAction, issueRecoveryCodeAction, linkEmailAction, signOutAction } from "@/app/actions/session";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Section } from "./section";

export function AccountSection({ provider, isAnonymous }: { provider: "local" | "supabase"; isAnonymous: boolean }) {
  return (
    <>
      <Section
        title="계정 복구"
        id="recovery"
        description="BETWEEN 은 가입 없이 익명 세션으로 동작해요. 익명 세션을 잃으면(브라우저 데이터 삭제, 기기 변경) 복구가 어려워요."
      >
        {provider === "local" ? <RecoveryCode /> : <EmailLink isAnonymous={isAnonymous} />}
      </Section>
      <Section title="계정">
        <div className="divide-y divide-white/5">
          <SignOut />
          <DeleteAccount />
        </div>
      </Section>
    </>
  );
}

function RecoveryCode() {
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function issue() {
    start(async () => {
      const r = await issueRecoveryCodeAction();
      if (!r.ok) return void toast.error(r.error);
      setCode(r.data.code);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        복구 코드를 저장해 두면 다른 기기나 브라우저에서도 이 프로필로 돌아올 수 있어요. 새로 발급하면 이전 코드는 사용할 수 없어요.
      </p>
      <Button onClick={issue} disabled={pending} variant="secondary" className="h-11 w-full rounded-xl" data-testid="issue-recovery">
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        복구 코드 발급
      </Button>
      <Dialog open={!!code} onOpenChange={(o) => !o && setCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>복구 코드</DialogTitle>
            <DialogDescription>이 코드는 지금 한 번만 보여요. 안전한 곳(비밀번호 관리자 등)에 보관하세요.</DialogDescription>
          </DialogHeader>
          <p
            className="rounded-xl bg-secondary p-4 text-center font-mono text-lg font-bold tracking-wider break-all select-all"
            data-testid="recovery-code"
          >
            {code}
          </p>
          <p className="flex gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-4 shrink-0 text-accent" />
            코드를 아는 사람은 누구나 내 프로필에 접근할 수 있어요. 다른 사람에게 절대 알려주지 마세요.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code ?? "");
                  toast.success("복구 코드를 복사했어요.");
                } catch {
                  toast.error("복사하지 못했어요. 직접 적어 두세요.");
                }
              }}
            >
              <Copy /> 복사
            </Button>
            <Button onClick={() => setCode(null)}>저장했어요</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmailLink({ isAnonymous }: { isAnonymous: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (!isAnonymous) {
    return <p className="text-sm">이메일이 연결된 계정이에요. 다른 기기에서는 이메일 로그인 링크로 복구할 수 있어요.</p>;
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await linkEmailAction({ email });
          if (!r.ok) return void toast.error(r.error);
          setSent(true);
        });
      }}
    >
      <p className="text-sm text-muted-foreground">
        선택 사항이에요. 이메일은 계정 복구에만 사용되고 다른 사용자에게 공개되지 않아요.
      </p>
      <label htmlFor="recovery-email" className="sr-only">
        복구용 이메일
      </label>
      <Input
        id="recovery-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="복구용 이메일"
        className="h-11 rounded-xl"
      />
      <Button type="submit" disabled={pending || !email} variant="secondary" className="h-11 w-full rounded-xl">
        {pending ? <Loader2 className="animate-spin" /> : <Mail />}
        확인 메일 보내기
      </Button>
      {sent && <p className="text-sm text-success">확인 메일을 보냈어요. 메일의 링크를 누르면 연결이 완료돼요.</p>}
    </form>
  );
}

function SignOut() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("로그아웃할까요? 복구 코드가 없으면 이 프로필로 돌아올 수 없어요.")) return;
        start(async () => {
          const r = await signOutAction();
          if (!r.ok) return void toast.error(r.error);
          router.push(r.data.redirect);
          router.refresh();
        });
      }}
      className="flex w-full items-center gap-3 pb-3 text-left text-sm font-semibold"
    >
      <LogOut className="size-4 text-muted-foreground" /> 로그아웃
    </button>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();
  return (
    <AlertDialog onOpenChange={(o) => !o && setConfirmText("")}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 pt-3 text-left text-sm font-semibold text-destructive"
          data-testid="delete-account"
        >
          <Trash2 className="size-4" /> 계정·개인정보 완전 삭제
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>모든 정보를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            프로필, 사진, 연락 방법, 좋아요·매칭 기록이 즉시 영구 삭제되고 복구할 수 없어요. 계속하려면 아래에 &lsquo;삭제&rsquo;를
            입력하세요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label htmlFor="delete-confirm" className="sr-only">
          삭제 확인 입력
        </label>
        <Input
          id="delete-confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="삭제"
          autoComplete="off"
          className="h-11 rounded-xl"
          data-testid="delete-confirm-input"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={confirmText !== "삭제" || pending}
            data-testid="delete-confirm"
            onClick={() =>
              start(async () => {
                const r = await deleteAccountAction({ confirm: confirmText });
                if (!r.ok) return void toast.error(r.error);
                toast.success("모든 정보가 삭제됐어요.");
                router.push("/");
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            영구 삭제
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
