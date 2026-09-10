/**
 * SMTP 自检 —— 用来确认"验证码能不能真发出去"。
 *
 * 用法：
 *   node scripts/dev.mjs mail:test you@example.com
 *   node scripts/dev.mjs mail:test            # 只检查配置，不发信
 *
 * 这个脚本**故意不 import 应用代码**，自己读 env、自己建 transporter：
 * 它是排障工具，应该独立于应用逻辑，也能在应用启动不了的时候跑。
 */
import nodemailer from "nodemailer";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const ok = (m) => console.log(`${GREEN}✔${RESET} ${m}`);
const bad = (m) => console.log(`${RED}✖${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}!${RESET} ${m}`);
const step = (m) => console.log(`\n${DIM}→${RESET} ${m}`);

function mask(value) {
  if (!value) return "(空)";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export async function main({ to } = {}) {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = (process.env.SMTP_SECURE ?? "true") !== "false";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim() || user;
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Minecraft Server";

  console.log(`${BOLD}SMTP 自检${RESET}\n`);
  console.log(
    `${DIM}下面这些是「发件邮箱」—— 一个就够。收件人是用户在页面上填的，不用配。${RESET}\n`
  );
  console.log(`  SMTP_HOST   ${host || `${RED}(未设置)${RESET}`}`);
  console.log(`  SMTP_PORT   ${process.env.SMTP_PORT ? port : `${DIM}默认 465${RESET}`}`);
  console.log(
    `  SMTP_SECURE ${process.env.SMTP_SECURE ? String(secure) : `${DIM}默认 true${RESET}`} ${
      secure ? DIM + "(隐式 TLS，配 465)" + RESET : DIM + "(STARTTLS，配 587)" + RESET
    }`
  );
  console.log(`  SMTP_USER   ${user || `${RED}(未设置)${RESET}`}  ${DIM}← 发件邮箱账号${RESET}`);
  console.log(`  SMTP_PASS   ${pass ? mask(pass) : `${RED}(未设置)${RESET}`}`);
  console.log(
    `  SMTP_FROM   ${from || `${RED}(未设置)${RESET}`}  ${DIM}← 收件人看到的发件地址${RESET}`
  );

  const missing = [
    !host && "SMTP_HOST",
    !user && "SMTP_USER",
    !pass && "SMTP_PASS",
  ].filter(Boolean);

  if (missing.length) {
    bad(`缺少配置：${missing.join("、")}`);
    console.log(`
${BOLD}怎么配${RESET}
  在项目根目录的 ${BOLD}.env${RESET} 里取消注释并填写（QQ 邮箱为例）：

    SMTP_HOST="smtp.qq.com"
    SMTP_PORT="465"
    SMTP_SECURE="true"
    SMTP_USER="你的QQ邮箱@qq.com"
    SMTP_PASS="授权码"          ${DIM}# 不是登录密码${RESET}
    SMTP_FROM="你的QQ邮箱@qq.com"

${BOLD}拿授权码${RESET}（QQ 邮箱）
  设置 → 账户 → POP3/IMAP/SMTP服务 → 开启「IMAP/SMTP服务」
  → 按提示发短信 → 得到一串 16 位授权码

${BOLD}其他服务商${RESET}
  QQ邮箱    smtp.qq.com         465  secure=true
  网易163   smtp.163.com        465  secure=true
  Gmail     smtp.gmail.com      465  secure=true   ${DIM}# 需应用专用密码${RESET}
  Outlook   smtp.office365.com  587  secure=false
  自建      <你的域名>           465 或 587

${DIM}不配也能用：开发环境会把验证码打到 dev server 控制台并显示在页面上。${RESET}
`);
    return 1;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // 连接阶段的常见超时，避免卡住
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  step("连接并登录 SMTP 服务器…");
  try {
    await transporter.verify();
    ok("连接成功，认证通过");
  } catch (err) {
    bad(`连接失败：${err.code ?? ""} ${err.message}`);

    const hints = {
      EAUTH:
        "认证被拒。多半是用了邮箱登录密码而不是「授权码」，或者服务商没开启 SMTP 服务。",
      ECONNECTION:
        "连不上。检查 SMTP_HOST / SMTP_PORT；如果 host 是域名，确认本机能解析它。",
      ETIMEDOUT:
        "超时。465 走隐式 TLS（SMTP_SECURE=true），587 走 STARTTLS（SMTP_SECURE=false），写反了就会卡在这里。",
      ESOCKET: "TLS 握手失败，同上：确认 465/587 与 SMTP_SECURE 是否匹配。",
      ECONNREFUSED: "端口被拒绝。换成 465 或 587 再试。",
    };
    const hint = hints[err.code];
    if (hint) console.log(`\n${YELLOW}可能的原因：${RESET}${hint}`);

    if (port === 25) {
      console.log(
        `\n${YELLOW}注意：${RESET}25 端口几乎被所有云厂商（含阿里云 ECS）默认封禁，请改用 465 或 587。`
      );
    }
    return 1;
  }

  if (!to) {
    warn("没有提供收件邮箱，跳过实际发信。");
    console.log(
      `\n${DIM}要发一封测试邮件：node scripts/dev.mjs mail:test you@example.com${RESET}`
    );
    return 0;
  }

  step(`发送测试邮件到 ${to}…`);
  try {
    const info = await transporter.sendMail({
      from: `"${siteName}" <${from}>`,
      to,
      subject: `【${siteName}】SMTP 测试 / Test message`,
      text: [
        "这是一封测试邮件，说明 SMTP 配置正确。",
        "验证码邮件会用同样的通道发出。",
        "",
        "This is a test message — your SMTP settings work.",
        "Verification codes will go out through the same channel.",
      ].join("\n"),
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,'PingFang SC','Microsoft YaHei',sans-serif;padding:20px">
        <p style="margin:0 0 8px">这是一封测试邮件，说明 SMTP 配置正确。</p>
        <p style="margin:0;color:#6b7280;font-size:13px">Verification codes will go out through the same channel.</p>
      </div>`,
    });
    ok(`已发送（messageId: ${info.messageId}）`);
    console.log(`\n${DIM}去收件箱看一下，顺便检查是否进了垃圾邮件。${RESET}`);
    return 0;
  } catch (err) {
    bad(`发送失败：${err.code ?? ""} ${err.message}`);
    if (err.responseCode === 550 || err.responseCode === 553) {
      console.log(
        `\n${YELLOW}可能的原因：${RESET}发件地址被拒。SMTP_FROM 必须和 SMTP_USER 是同一个邮箱 —— ` +
          "多数服务商不允许用别人的地址发信。"
      );
    }
    return 1;
  }
}

export default main;
