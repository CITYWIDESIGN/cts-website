import Link from "next/link";
import { Box } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 font-semibold", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Box className="size-4" />
      </span>
      <span className="text-sm tracking-tight sm:text-base">
        {siteConfig.name}
      </span>
    </Link>
  );
}
