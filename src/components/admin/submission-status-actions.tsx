"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { adminUpdateSubmissionStatus } from "@/lib/actions/questionnaire";
import { Button } from "@/components/ui/button";

export function SubmissionStatusActions({
  submissionId,
  status,
}: {
  submissionId: string;
  status: string;
}) {
  const t = useTranslations("admin.results.review");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function update(next: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await adminUpdateSubmissionStatus(submissionId, next);
      if (result.ok) {
        toast.success(t("statusUpdated"));
        router.refresh();
      } else {
        toast.error(t("statusUpdated"));
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={status === "APPROVED" ? "default" : "outline"}
        size="sm"
        onClick={() => update("APPROVED")}
        disabled={isPending}
      >
        <Check />
        {t("approve")}
      </Button>
      <Button
        variant={status === "REJECTED" ? "destructive" : "outline"}
        size="sm"
        onClick={() => update("REJECTED")}
        disabled={isPending}
      >
        <X />
        {t("reject")}
      </Button>
    </div>
  );
}
