/**
 * 发送一封**真实模板**的验证码邮件预览。
 *
 * 用法：node scripts/dev.mjs mail:preview you@example.com
 *
 * 和 mail:test 的区别：那个只验证 SMTP 通不通（正文是一句话），
 * 这个用的是注册/找回密码真正发出去的那套 HTML 模板，
 * 验证码是假的（428917），只是用来看排版。
 */
import { isMailConfigured, sendMail, verificationMail } from "@/server/mailer";

const to = process.argv[2];

if (!to) {
  console.error("用法：node scripts/dev.mjs mail:preview <收件邮箱>");
  process.exit(1);
}

if (!isMailConfigured()) {
  console.error("SMTP 还没配置。先跑：node scripts/dev.mjs mail:test");
  process.exit(1);
}

const DEMO_CODE = "428917";

for (const purpose of ["bind", "reset"] as const) {
  const mail = verificationMail(DEMO_CODE, 10, purpose, {
    ip: "203.0.113.42",
    requestedAt: new Date(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined,
  });

  await sendMail({
    to,
    subject: `[预览] ${mail.subject}`,
    text: mail.text,
    html: mail.html,
  });

  console.log(
    `✔ 已发送「${purpose === "bind" ? "邮箱验证" : "重置密码"}」模板预览到 ${to}`
  );
}

console.log("\n去收件箱看看排版（顺便确认深色模式下的样子）。");
