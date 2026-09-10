"use client";

import * as React from "react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ClipboardList,
  ExternalLink,
  EyeOff,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { adminSaveJoinConfig } from "@/lib/actions/admin-join";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  JOIN_ACTION_KINDS,
  type JoinActionKind,
  type JoinConfig,
} from "@/lib/validators/join-config";
import { cn } from "@/lib/utils";

export interface QuestionnaireOption {
  id: string;
  title: string;
  submissions: number;
}

/** Radix Select 不接受空字符串值，用哨兵表示"用最新的" */
const LATEST = "__latest__";

const KIND_ICONS: Record<JoinActionKind, LucideIcon> = {
  questionnaire: ClipboardList,
  link: ExternalLink,
  page: FileText,
  disabled: EyeOff,
};

/**
 * 后台：「加入我们」按钮的行为配置。
 *
 * 这个是纯受控表单 —— 保存前可以先看「效果预览」，避免改完才发现配错了方向。
 * 全部校验在服务端再做一遍（@/lib/actions/admin-join），这里只做即时提示。
 */
export function JoinConfigForm({
  initialConfig,
  questionnaires,
}: {
  initialConfig: JoinConfig;
  questionnaires: QuestionnaireOption[];
}) {
  const t = useTranslations("admin.join");
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = React.useState<JoinActionKind>(initialConfig.action.kind);
  const [requireLogin, setRequireLogin] = React.useState(initialConfig.requireLogin);

  /*
    问卷下拉的初始值：配置里指定的那份可能已经下线/删掉了，如果还硬把它当
    选中值，Radix 会渲染出一个空白的触发器。检测不到就退回"最新发布的" ——
    这也正好和服务端 loadJoinState 的兜底行为一致。
  */
  const [questionnaireId, setQuestionnaireId] = React.useState(() => {
    const initial = initialConfig.action;
    if (
      initial.kind === "questionnaire" &&
      initial.questionnaireId &&
      questionnaires.some((q) => q.id === initial.questionnaireId)
    ) {
      return initial.questionnaireId;
    }
    return LATEST;
  });
  const [url, setUrl] = React.useState(
    initialConfig.action.kind === "link" ? initialConfig.action.url : ""
  );
  const [newTab, setNewTab] = React.useState(
    initialConfig.action.kind === "link" ? initialConfig.action.newTab : true
  );
  const [path, setPath] = React.useState(
    initialConfig.action.kind === "page" ? initialConfig.action.path : "/"
  );

  const selectedQuestionnaire = questionnaires.find((q) => q.id === questionnaireId);
  const noQuestionnaires = questionnaires.length === 0;

  /** 把表单状态拼成要提交的配置 */
  function buildConfig(): JoinConfig {
    const action: JoinConfig["action"] =
      kind === "questionnaire"
        ? { kind, questionnaireId: questionnaireId === LATEST ? null : questionnaireId }
        : kind === "link"
          ? { kind, url: url.trim(), newTab }
          : kind === "page"
            ? { kind, path: path.trim() }
            : { kind: "disabled" };

    return { requireLogin, action };
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config = buildConfig();

    startTransition(async () => {
      const res = await adminSaveJoinConfig(config);
      if (!res.ok) {
        const key = `errors.${res.error ?? "unknown"}`;
        toast.error(t.has(key) ? t(key) : t("errors.unknown"));
        return;
      }
      toast.success(t("saved"));
    });
  }

  /** 预览：未登录 / 已登录 分别会跳到哪 */
  function preview(authed: boolean): string {
    if (kind === "disabled") return t("preview.hidden");
    if (!authed && requireLogin) return t("preview.toLogin");
    if (kind === "questionnaire") {
      return t("preview.toQuestionnaire", {
        name: selectedQuestionnaire?.title ?? t("latest"),
      });
    }
    if (kind === "link") return t("preview.toLink", { url: url.trim() || "—" });
    return t("preview.toPage", { path: path.trim() || "—" });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">{t("behaviorTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("behaviorHint")}</p>
          </div>

          <RadioGroup
            value={kind}
            onValueChange={(v) => setKind(v as JoinActionKind)}
            className="grid gap-2 sm:grid-cols-2"
          >
            {JOIN_ACTION_KINDS.map((k) => {
              const Icon = KIND_ICONS[k];
              const active = kind === k;
              return (
                <Label
                  key={k}
                  htmlFor={`join-kind-${k}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors duration-200",
                    active ? "border-primary/50 bg-primary/5" : "hover:bg-accent/50"
                  )}
                >
                  <RadioGroupItem
                    value={k}
                    id={`join-kind-${k}`}
                    className="mt-0.5"
                    disabled={k === "questionnaire" && noQuestionnaires}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      {t(`kinds.${k}.title`)}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {t(`kinds.${k}.description`)}
                    </span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>

          {/* 选项明细：只显示当前选中的那种行为需要填的字段 */}
          {kind === "questionnaire" && (
            <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4">
              {noQuestionnaires ? (
                <p className="text-xs text-warning">{t("noQuestionnaires")}</p>
              ) : (
                <>
                  <Label htmlFor="join-questionnaire" className="text-xs">
                    {t("questionnaireLabel")}
                  </Label>
                  <Select value={questionnaireId} onValueChange={setQuestionnaireId}>
                    <SelectTrigger id="join-questionnaire" className="w-full sm:w-80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/*
                        下拉项只放标题 —— Radix 的 SelectValue 会把选中项的
                        ItemText 内容原样回显到触发器上，选项里多塞一个"3 份提交"
                        的角标，触发器里也会跟着出现。
                        问卷的提交量放在下面单独一行显示。
                      */}
                      <SelectItem value={LATEST}>{t("latest")}</SelectItem>
                      {questionnaires.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedQuestionnaire && (
                    <p className="text-xs text-muted-foreground">
                      {t("selectedQuestionnaire", {
                        name: selectedQuestionnaire.title,
                        count: selectedQuestionnaire.submissions,
                      })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{t("questionnaireHint")}</p>
                </>
              )}
            </div>
          )}

          {kind === "link" && (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="join-url" className="text-xs">
                  {t("urlLabel")}
                </Label>
                <Input
                  id="join-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://qm.qq.com/q/..."
                  inputMode="url"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{t("urlHint")}</p>
              </div>

              <Label
                htmlFor="join-newtab"
                className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-background px-3 py-2.5"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{t("newTabLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("newTabHint")}</span>
                </span>
                <Switch id="join-newtab" checked={newTab} onCheckedChange={setNewTab} />
              </Label>
            </div>
          )}

          {kind === "page" && (
            <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4">
              <Label htmlFor="join-path" className="text-xs">
                {t("pathLabel")}
              </Label>
              <Input
                id="join-path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/server"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">{t("pathHint")}</p>
            </div>
          )}

          {kind === "disabled" && (
            <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
              {t("disabledHint")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 登录要求：关闭入口时这一项没有意义，直接不显示 */}
      {kind !== "disabled" && (
        <Card>
          <CardContent className="pt-6">
            <Label
              htmlFor="join-require-login"
              className="flex cursor-pointer items-start justify-between gap-4"
            >
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">{t("requireLoginLabel")}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {t("requireLoginHint")}
                </span>
              </span>
              <Switch
                id="join-require-login"
                checked={requireLogin}
                onCheckedChange={setRequireLogin}
                className="mt-0.5"
              />
            </Label>
          </CardContent>
        </Card>
      )}

      {/* 效果预览：把"未登录"和"已登录"两条路径都摊开，避免配完才发现跳错 */}
      <Card className="bg-muted/30">
        <CardContent className="flex flex-col gap-2 pt-6">
          <h2 className="text-sm font-medium">{t("previewTitle")}</h2>
          <dl className="flex flex-col gap-1.5 text-xs">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">{t("previewGuest")}</dt>
              <dd className="min-w-0 break-all">{preview(false)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">{t("previewUser")}</dt>
              <dd className="min-w-0 break-all">{preview(true)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{t("previewNote")}</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || (kind === "questionnaire" && noQuestionnaires)}>
          {isPending ? t("saving") : t("save")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("applyHint")}</p>
      </div>
    </form>
  );
}
