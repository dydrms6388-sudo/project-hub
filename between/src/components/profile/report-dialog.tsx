"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reportAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS, type ReportReason } from "@/lib/domain/options";

export function ReportDialog({
  open,
  onOpenChange,
  targetId,
  nickname,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetId: string;
  nickname: string;
  onDone: (blocked: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (!reason) return;
      const r = await reportAction({ targetId, reason, detail, alsoBlock });
      if (!r.ok) return void toast.error(r.error);
      toast.success("신고가 접수됐어요. 운영팀이 검토할게요.");
      onOpenChange(false);
      onDone(alsoBlock);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" data-testid="report-dialog">
        <DialogHeader>
          <DialogTitle>{nickname}님 신고</DialogTitle>
          <DialogDescription>
            신고 내용은 상대에게 알려지지 않아요. 긴급한 위험은 112 에 먼저 신고해 주세요.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)} className="gap-2">
          {REPORT_REASONS.map((r) => (
            <Label
              key={r.value}
              htmlFor={`reason-${r.value}`}
              className="bg-secondary/60 has-[[data-state=checked]]:ring-primary flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 font-normal has-[[data-state=checked]]:ring-1"
            >
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              {r.label}
            </Label>
          ))}
        </RadioGroup>
        <Textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value.slice(0, 500))}
          placeholder="자세한 내용 (선택, 500자)"
          aria-label="신고 상세 내용"
          className="min-h-20"
        />
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox checked={alsoBlock} onCheckedChange={(c) => setAlsoBlock(c === true)} /> 이 사용자 차단하기
        </Label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant="destructive" disabled={!reason || pending} onClick={submit} data-testid="report-submit">
            {pending && <Loader2 className="animate-spin" />}
            신고하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
