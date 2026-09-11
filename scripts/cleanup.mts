/**
 * 过期数据清理的入口（`debug.bat cleanup`）。
 *
 * 真正的逻辑在 `src/server/retention.ts` —— 那边是 server-only 的，
 * 这里只负责加载环境变量、跑一次、把结果打成人能看的样子。
 *
 * 生产上挂个 cron 每天跑一次就够，例如：
 *   30 4 * * * cd /srv/cts-website && node scripts/cleanup.mts >> logs/cleanup.log 2>&1
 */
import { pruneOldData, RETENTION_DAYS } from "../src/server/retention";

const LABELS: Record<string, string> = {
  emailCodes: "过期 / 已用验证码",
  downloadRecords: "下载明细",
  transferUsage: "每日流量计数",
  dailyAction: "每日次数计数",
  readNotifications: "已读站内消息",
  auditLogs: "审计日志",
};

const dryRun = process.argv.includes("--dry-run");

const result = await pruneOldData({ dryRun });

console.log("");
console.log(dryRun ? "  演习模式（--dry-run）：只统计，不删除" : "  已清理：");
console.log("");

let total = 0;
for (const [key, count] of Object.entries(result)) {
  total += count;
  const label = LABELS[key] ?? key;
  console.log(`    ${label.padEnd(18)} ${String(count).padStart(8)} 行`);
}
console.log("");
console.log(`    合计 ${total} 行`);
console.log("");
console.log(
  `  保留期：验证码 ${RETENTION_DAYS.emailCodes} 天 · ` +
    `统计明细 ${RETENTION_DAYS.downloadRecords} 天 · ` +
    `审计 ${RETENTION_DAYS.auditLogs} 天`
);
console.log("");
