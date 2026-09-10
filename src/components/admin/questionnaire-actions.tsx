"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateQuestionnaire,
  adminUpdateQuestionnaireStatus,
  adminDeleteQuestionnaire,
} from "@/lib/actions/questionnaire";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function NewQuestionnaireButton() {
  const t = useTranslations("admin.questionnaireManagement");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await adminCreateQuestionnaire({ title: "Untitled" });
      if (result.ok && result.id) {
        router.push(`/admin/questionnaires/${result.id}/edit`);
      } else {
        toast.error(t("title"));
      }
    });
  }

  return (
    <Button onClick={handleCreate} disabled={isPending}>
      <Plus />
      {t("new")}
    </Button>
  );
}

export function QuestionnaireStatusButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const t = useTranslations("admin.questionnaireManagement");
  const [isPending, startTransition] = useTransition();

  const next =
    status === "PUBLISHED" ? "PAUSED" : "PUBLISHED";
  const label =
    status === "PUBLISHED" ? t("pause") : t("publish");

  function handle() {
    startTransition(async () => {
      const result = await adminUpdateQuestionnaireStatus(id, next as "PUBLISHED" | "PAUSED");
      if (!result.ok) toast.error(t("title"));
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handle}
      disabled={isPending}
    >
      {status === "PUBLISHED" ? <Pause /> : <Play />}
      {label}
    </Button>
  );
}

export function DeleteQuestionnaireButton({ id }: { id: string }) {
  const t = useTranslations("admin.questionnaireManagement");
  const common = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await adminDeleteQuestionnaire(id);
      setOpen(false);
      if (!result.ok) toast.error(common("error"));
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{common("delete")}</DialogTitle>
            <DialogDescription>{t("deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {common("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handle}
              disabled={isPending}
            >
              {common("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
