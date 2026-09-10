"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { EASE_OUT } from "@/components/motion/transitions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitQuestionnaire } from "@/lib/actions/questionnaire";
import { cn } from "@/lib/utils";

export type FormQuestionnaire = {
  id: string;
  title: string;
  description: string | null;
  questions: Array<{
    id: string;
    type: string;
    title: string;
    required: boolean;
    sortOrder: number;
    options: Array<{ id: string; text: string }>;
  }>;
};

type AnswerValue = string | string[];

function serializeValue(value: AnswerValue | undefined): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  return value ?? "";
}

function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim() === "";
}

export function QuestionnaireForm({
  questionnaire,
}: {
  questionnaire: FormQuestionnaire;
}) {
  const t = useTranslations("questionnaire");
  const common = useTranslations("common");
  const router = useRouter();
  const reduce = useReducedMotion();

  const questions = React.useMemo(
    () => [...questionnaire.questions].sort((a, b) => a.sortOrder - b.sortOrder),
    [questionnaire.questions]
  );

  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  /** 前进/后退方向，决定步骤切换的滑动方向 */
  const [direction, setDirection] = React.useState<1 | -1>(1);

  const current = questions[step];
  const total = questions.length;
  const progress = Math.round(((step + (done ? 1 : 0)) / total) * 100);
  const currentValue = current ? answers[current.id] : undefined;
  const canNext = current ? !(current.required && isEmpty(currentValue)) : false;

  function setValue(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function goNext() {
    setDirection(1);
    if (step < total - 1) {
      setStep((s) => s + 1);
    } else {
      setConfirmOpen(true);
    }
  }

  function goBack() {
    setDirection(-1);
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const payload = {
      answers: questions.map((q) => ({
        questionId: q.id,
        value: serializeValue(answers[q.id]),
      })),
    };

    const result = await submitQuestionnaire(questionnaire.id, payload);
    setSubmitting(false);
    setConfirmOpen(false);

    if (result.ok) {
      setDone(true);
    } else {
      toast.error(common("error"));
    }
  }

  function handleDone() {
    router.push(`/questionnaires/${questionnaire.id}/result`);
    router.refresh();
  }

  if (done) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <motion.span
          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 260, damping: 18, delay: 0.1 }
          }
          className="flex size-16 items-center justify-center rounded-full bg-success/15"
        >
          <CheckCircle2 className="size-8 text-success" />
        </motion.span>
        <h1 className="mt-6 text-2xl font-semibold">{t("submitSuccess")}</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          {t("submitSuccessDescription")}
        </p>
        <Button className="mt-8" onClick={handleDone}>
          {t("viewSubmission")}
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {questionnaire.title}
        </h1>
        {questionnaire.description && (
          <p className="text-sm text-muted-foreground">
            {questionnaire.description}
          </p>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("question", { current: step + 1, total })}
          </span>
          <motion.span
            key={progress}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="tabular-nums"
          >
            {progress}%
          </motion.span>
        </div>
        <Progress value={progress} className="mt-2" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          initial={
            reduce
              ? false
              : { opacity: 0, x: direction * 16, filter: "blur(4px)" }
          }
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, x: direction * -16, filter: "blur(4px)" }
          }
          transition={{ duration: 0.32, ease: EASE_OUT }}
          className="mt-8"
        >
          <div className="flex items-start gap-2">
            <h2 className="text-base font-medium sm:text-lg">{current.title}</h2>
            {current.required && (
              <span className="mt-0.5 text-sm text-destructive">*</span>
            )}
          </div>

          {current.type === "MULTIPLE_CHOICE" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("multiSelectHint")}
            </p>
          )}

          <Stagger
            inView={false}
            stagger={0.055}
            delay={0.08}
            className="mt-4"
          >
            {current.type === "SINGLE_CHOICE" && (
              <Stagger inView={false} stagger={0.05} className="flex flex-col gap-2">
                <RadioGroup
                  value={(currentValue as string) ?? ""}
                  onValueChange={(v) => setValue(current.id, v)}
                  className="gap-2"
                >
                  {current.options.map((opt, i) => (
                    <StaggerItem key={opt.id} index={i}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300 hover:bg-accent",
                          currentValue === opt.text &&
                            "border-primary bg-accent shadow-xs"
                        )}
                      >
                        <RadioGroupItem value={opt.text} id={opt.id} />
                        <span className="text-sm">{opt.text}</span>
                      </label>
                    </StaggerItem>
                  ))}
                </RadioGroup>
              </Stagger>
            )}

            {current.type === "MULTIPLE_CHOICE" && (
              <Stagger inView={false} stagger={0.05} className="flex flex-col gap-2">
                {current.options.map((opt, i) => {
                  const values = (currentValue as string[]) ?? [];
                  const checked = values.includes(opt.text);
                  return (
                    <StaggerItem key={opt.id} index={i}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300 hover:bg-accent",
                          checked && "border-primary bg-accent shadow-xs"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? [...values, opt.text]
                              : values.filter((x) => x !== opt.text);
                            setValue(current.id, next);
                          }}
                          id={opt.id}
                        />
                        <span className="text-sm">{opt.text}</span>
                      </label>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}

            {current.type === "TEXT" && (
              <StaggerItem index={0}>
                <Input
                  value={(currentValue as string) ?? ""}
                  onChange={(e) => setValue(current.id, e.target.value)}
                  placeholder={t("yourAnswer")}
                  maxLength={500}
                />
              </StaggerItem>
            )}

            {current.type === "TEXTAREA" && (
              <StaggerItem index={0}>
                <Textarea
                  value={(currentValue as string) ?? ""}
                  onChange={(e) => setValue(current.id, e.target.value)}
                  placeholder={t("yourAnswer")}
                  rows={5}
                  maxLength={5000}
                />
              </StaggerItem>
            )}
          </Stagger>
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between">
        <Stagger
          inView={false}
          stagger={0.08}
          className="flex w-full items-center justify-between"
        >
          <StaggerItem index={0}>
            <Button variant="ghost" onClick={goBack} disabled={step === 0} className="group">
              <ArrowLeft className="transition-transform duration-300 group-enabled:group-hover:-translate-x-0.5" />
              {common("previous")}
            </Button>
          </StaggerItem>

          <StaggerItem index={1}>
            {step < total - 1 ? (
              <Button onClick={goNext} disabled={!canNext} className="group">
                {common("next")}
                <ArrowRight className="transition-transform duration-300 group-enabled:group-hover:translate-x-0.5" />
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canNext} className="group">
                {common("submit")}
                <Send className="transition-transform duration-300 group-enabled:group-hover:translate-x-0.5" />
              </Button>
            )}
          </StaggerItem>
        </Stagger>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("submitConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("submitConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              {common("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? common("submitting") : common("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
