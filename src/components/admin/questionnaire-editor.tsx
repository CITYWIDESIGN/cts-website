"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
  Save,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { adminSaveQuestionnaire } from "@/lib/actions/questionnaire";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TEXT" | "TEXTAREA";
type QuestionnaireStatus = "DRAFT" | "PUBLISHED" | "PAUSED";

type EditorOption = { id: string; text: string };
type EditorQuestion = {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options: EditorOption[];
};

let tempId = 0;
function genId(prefix: string) {
  return `temp-${prefix}-${++tempId}`;
}

export type EditorQuestionnaire = {
  id: string;
  title: string;
  description: string | null;
  status: QuestionnaireStatus;
  questions: Array<{
    id: string;
    type: QuestionType;
    title: string;
    required: boolean;
    sortOrder: number;
    options: Array<{ id: string; text: string; sortOrder: number }>;
  }>;
};

export function QuestionnaireEditor({
  questionnaire,
}: {
  questionnaire: EditorQuestionnaire;
}) {
  const t = useTranslations("admin.editor");
  const common = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = React.useState(questionnaire.title);
  const [description, setDescription] = React.useState(
    questionnaire.description ?? ""
  );
  const [status, setStatus] = React.useState<QuestionnaireStatus>(
    questionnaire.status
  );
  const [questions, setQuestions] = React.useState<EditorQuestion[]>(
    [...questionnaire.questions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((q) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        required: q.required,
        options: q.options
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o) => ({ id: o.id, text: o.text })),
      }))
  );

  function updateQuestion(id: string, patch: Partial<EditorQuestion>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
  }

  function addQuestion() {
    const type = (questions.length === 0
      ? "SINGLE_CHOICE"
      : "TEXT") as QuestionType;
    setQuestions((prev) => [
      ...prev,
      {
        id: genId("q"),
        type,
        title: "",
        required: true,
        options:
          type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
            ? [
                { id: genId("o"), text: "" },
                { id: genId("o"), text: "" },
              ]
            : [],
      },
    ]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function moveQuestion(index: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addOption(questionId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: [...q.options, { id: genId("o"), text: "" }] }
          : q
      )
    );
  }

  function updateOption(
    questionId: string,
    optionId: string,
    text: string
  ) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((o) =>
                o.id === optionId ? { ...o, text } : o
              ),
            }
          : q
      )
    );
  }

  function removeOption(questionId: string, optionId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
          : q
      )
    );
  }

  function changeType(questionId: string, type: QuestionType) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const isChoice = type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
        return {
          ...q,
          type,
          options: isChoice
            ? q.options.length > 0
              ? q.options
              : [
                  { id: genId("o"), text: "" },
                  { id: genId("o"), text: "" },
                ]
            : [],
        };
      })
    );
  }

  function save() {
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      questions: questions.map((q, i) => ({
        id: q.id.startsWith("temp-") ? undefined : q.id,
        type: q.type,
        title: q.title,
        required: q.required,
        sortOrder: i,
        options: q.options.map((o, j) => ({
          id: o.id.startsWith("temp-") ? undefined : o.id,
          text: o.text,
          sortOrder: j,
        })),
      })),
    };

    startTransition(async () => {
      const result = await adminSaveQuestionnaire(questionnaire.id, payload);
      if (result.ok) {
        toast.success(t("saveSuccess"));
        router.refresh();
      } else {
        toast.error(t("saveError"));
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/questionnaires")}>
          <ArrowLeft />
          {t("back")}
        </Button>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as QuestionnaireStatus)}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">{common("draft")}</SelectItem>
              <SelectItem value="PUBLISHED">{common("published")}</SelectItem>
              <SelectItem value="PAUSED">{common("paused")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={save} disabled={isPending}>
            <Save />
            {isPending ? common("saving") : common("save")}
          </Button>
        </div>
      </div>

      <Card className="gap-4">
        <div className="flex flex-col gap-2 px-6 pt-6">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className="border-0 p-0 text-xl font-semibold shadow-none focus-visible:ring-0"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={2}
            className="resize-none border-0 p-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
          />
        </div>
        <Separator />
      </Card>

      <div className="flex flex-col gap-4">
        {questions.map((question, index) => {
          const isChoice =
            question.type === "SINGLE_CHOICE" ||
            question.type === "MULTIPLE_CHOICE";
          return (
            <Card key={question.id} className="gap-4">
              <div className="flex items-center gap-2 px-6 pt-5">
                <GripVertical className="size-4 text-muted-foreground" />
                <span className="font-mono text-sm text-muted-foreground">
                  {index + 1}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(index, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeQuestion(question.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-4 px-6">
                <Input
                  value={question.title}
                  onChange={(e) =>
                    updateQuestion(question.id, { title: e.target.value })
                  }
                  placeholder={t("questionTitlePlaceholder")}
                />

                <div className="flex items-center gap-3">
                  <Select
                    value={question.type}
                    onValueChange={(v) => changeType(question.id, v as QuestionType)}
                  >
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE_CHOICE">
                        {t("typeSingleChoice")}
                      </SelectItem>
                      <SelectItem value="MULTIPLE_CHOICE">
                        {t("typeMultipleChoice")}
                      </SelectItem>
                      <SelectItem value="TEXT">{t("typeText")}</SelectItem>
                      <SelectItem value="TEXTAREA">
                        {t("typeTextarea")}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="ml-auto flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">
                      {t("required")}
                    </Label>
                    <Switch
                      checked={question.required}
                      onCheckedChange={(v) =>
                        updateQuestion(question.id, { required: v })
                      }
                    />
                  </div>
                </div>

                {isChoice && (
                  <div className="flex flex-col gap-2 pb-2">
                    {question.options.map((option, oi) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border",
                            question.type === "MULTIPLE_CHOICE" && "rounded-[4px]"
                          )}
                        />
                        <Input
                          value={option.text}
                          onChange={(e) =>
                            updateOption(question.id, option.id, e.target.value)
                          }
                          placeholder={t("optionPlaceholder", { index: oi + 1 })}
                          className="h-8"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(question.id, option.id)}
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => addOption(question.id)}
                    >
                      <Plus />
                      {t("addOption")}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Button variant="outline" className="w-full" onClick={addQuestion}>
        <Plus />
        {t("addQuestion")}
      </Button>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={save} disabled={isPending} className="shadow-lg">
          <Save />
          {isPending ? common("saving") : common("save")}
        </Button>
      </div>
    </div>
  );
}
