"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Users,
  ShieldCheck,
  FileText,
  Clock,
  MessageSquare,
  FolderArchive,
  Download,
  Network,
} from "lucide-react";
import { CountUp } from "./count-up";
import { EASE_OUT, STAGGER } from "./transitions";

/**
 * 统计卡片：图标轻微弹出 + 数字滚动 + 卡片依次入场。
 *
 * 注意：图标通过名字（字符串）传入，而不是直接传组件。
 * 从服务端组件往客户端组件传组件/函数会触发
 * "Functions cannot be passed directly to Client Components"，所以这里在
 * 客户端侧用一张查找表把名字映射成组件。
 */
const ICONS = {
  users: Users,
  shield: ShieldCheck,
  file: FileText,
  clock: Clock,
  message: MessageSquare,
  archive: FolderArchive,
  download: Download,
  network: Network,
} as const;

export type StatIconName = keyof typeof ICONS;

export function StatCard({
  index = 0,
  iconName,
  value,
  label,
}: {
  index?: number;
  iconName: StatIconName;
  value: number;
  label: string;
}) {
  const reduce = useReducedMotion();
  const Icon = ICONS[iconName];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: EASE_OUT,
        delay: Math.min(index, 8) * STAGGER,
      }}
      className="group bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-md"
    >
      <div className="flex items-center gap-4 px-6">
        <motion.span
          initial={reduce ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.4,
            ease: EASE_OUT,
            delay: Math.min(index, 8) * STAGGER + 0.12,
          }}
          className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-105"
        >
          <Icon className="size-5" />
        </motion.span>
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            <CountUp value={value} />
          </p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}
