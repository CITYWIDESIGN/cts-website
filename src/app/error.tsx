"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const common = useTranslations("common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-sm text-muted-foreground">{t("description")}</p>
      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={reset}>
          {common("retry")}
        </Button>
      </div>
    </div>
  );
}
