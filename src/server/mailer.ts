import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * 发信。
 *
 * 走标准 SMTP，配置全部从环境变量读（见 .env.example 的 SMTP_* 段）。
 * 不绑定某一家服务商 —— QQ 邮箱 / 163 / Gmail / 自建 Postfix 都能用，
 * 只需要填 host / port / user / pass（一般是「授权码」而不是登录密码）。
 *
 * 没配置 SMTP 时：
 *   - 开发环境：把邮件内容打到服务端控制台，并让调用方拿到验证码，
 *     这样本地能完整跑通流程
 *   - 生产环境：直接报错，绝不把验证码回传给客户端
 */

const HOST = process.env.SMTP_HOST?.trim();
const PORT = Number(process.env.SMTP_PORT ?? 465);
const SECURE = (process.env.SMTP_SECURE ?? "true") !== "false";
const USER = process.env.SMTP_USER?.trim();
const PASS = process.env.SMTP_PASS;
const FROM = process.env.SMTP_FROM?.trim() || USER || "no-reply@localhost";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Minecraft Server";

/** 是否配置了 SMTP */
export function isMailConfigured(): boolean {
  return Boolean(HOST && USER && PASS);
}

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    auth: USER && PASS ? { user: USER, pass: PASS } : undefined,
  });
  return cached;
}

export class MailError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "SEND_FAILED"
  ) {
    super(message);
    this.name = "MailError";
  }
}

export interface SendResult {
  /** 未配置 SMTP 且在开发环境下，把验证码带回来给前端展示/记录 */
  devCode?: string;
  devBody?: string;
}

/**
 * 发一封纯文本 + HTML 的邮件。
 * `devCode` 只在"没配置 SMTP 且非生产环境"时回传，用于本地联调。
 */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** 开发模式下随结果回传，方便在页面上直接看到验证码 */
  devCode?: string;
}): Promise<SendResult> {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new MailError(
        "SMTP is not configured; cannot send mail in production.",
        "NOT_CONFIGURED"
      );
    }
    // 开发模式：打到控制台，流程照常走通
    console.warn(
      [
        "",
        "─────────── [mailer] SMTP 未配置，邮件未真实发送 ───────────",
        `To:      ${input.to}`,
        `Subject: ${input.subject}`,
        "",
        input.text,
        "───────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return { devCode: input.devCode, devBody: input.text };
  }

  try {
    await transporter().sendMail({
      from: `"${SITE_NAME}" <${FROM}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return {};
  } catch (err) {
    console.error("[mailer] send failed", err);
    throw new MailError("Failed to send mail.", "SEND_FAILED");
  }
}

/* ---------------------------------------------------------------------------
 * 验证码邮件模板
 *
 * 邮件客户端是另一个世界，跟网页不能一套写法：
 *   - **全部用 table 布局**：Outlook 用 Word 排版引擎，flex/grid 直接不认
 *   - **样式内联**：Gmail 会剥掉部分 <style>，所以默认值必须写在 style 属性上；
 *     <style> 块只用来做增强（深色模式、移动端）
 *   - **颜色用 hex**：oklch() 在邮件客户端里基本没人支持（下面这几个值是从
 *     站点的 oklch 主色换算过来的，保证观感一致）
 *   - **不放图片**：很多客户端默认屏蔽图片，一屏蔽整封信就空了；
 *     品牌标记用一个色块 + 文字就够了
 *   - **预header**：收件箱列表里显示的那行摘要，不放的话会露出正文第一句
 * ------------------------------------------------------------------------- */

/** 邮件客户端不认 oklch，这些是从 globals.css 的主色换算出来的 hex */
const C = {
  pageBg: "#F4F6F4",
  card: "#FFFFFF",
  border: "#E4E8E5",
  text: "#1B211D",
  muted: "#6C7A72",
  faint: "#9AA8A0",
  primary: "#2D7550",
  primarySoft: "#EDF5F0",
  codeBg: "#F3F7F4",
  codeBorder: "#D8E4DC",
  amber: "#A15C07",
  amberSoft: "#FDF6E9",
  amberBorder: "#F0DFBE",
  quoteBar: "#D8E4DC",
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
const MONO =
  "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 北京时间，带标签，避免收件人猜时区 */
function formatBeijing(date: Date): string {
  const s = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${s}（北京时间）`;
}

export interface VerificationMailMeta {
  /** 请求来源 IP，展示给用户做"是不是我"的判断 */
  ip?: string | null;
  /** 请求时间 */
  requestedAt?: Date;
  /** 站点地址，放在页脚 */
  siteUrl?: string;
}

/** 6 个数字方块，用 table 拼 —— Outlook 也能正常渲染 */
function digitCells(code: string): string {
  return code
    .split("")
    .map(
      (d, i) =>
        `${
          i > 0
            ? '<td width="8" style="width:8px;font-size:0;line-height:0">&nbsp;</td>'
            : ""
        }<td width="46" height="58" align="center" valign="middle" bgcolor="${C.codeBg}" class="code-cell" style="width:46px;height:58px;background:${C.codeBg};border:1px solid ${C.codeBorder};border-radius:10px;font-family:${MONO};font-size:26px;font-weight:700;color:${C.text};text-align:center;line-height:58px">${d}</td>`
    )
    .join("");
}

/** 验证码邮件的正文：中英双语，避免依赖请求语言 */
export function verificationMail(
  code: string,
  minutes: number,
  purpose: "register" | "bind" | "reset",
  meta: VerificationMailMeta = {}
) {
  const subjectZh =
    purpose === "reset"
      ? "重置密码验证码"
      : purpose === "register"
        ? "注册验证码"
        : "邮箱验证码";
  const titleZh =
    purpose === "reset"
      ? "重置你的密码"
      : purpose === "register"
        ? "确认你的邮箱"
        : "验证你的邮箱";
  const titleEn =
    purpose === "reset"
      ? "Reset your password"
      : purpose === "register"
        ? "Confirm your email"
        : "Verify your email";
  const subject = `【${SITE_NAME}】${subjectZh} / Verification code`;

  /** 用户会问的第一个问题："我为什么会收到这个" */
  const whyZh =
    purpose === "reset"
      ? `有人（大概是你）在 ${SITE_NAME} 申请重置密码。`
      : purpose === "register"
        ? `有人（大概是你）正在用这个邮箱在 ${SITE_NAME} 注册账号。`
        : `有人（大概是你）在 ${SITE_NAME} 填写了这个邮箱地址，用来换绑账号。`;

  const now = meta.requestedAt ?? new Date();
  const timeLine = formatBeijing(now);
  const ipLine = meta.ip && meta.ip !== "unknown" ? meta.ip : null;

  /* ---------------------------------------------------------- 纯文本版 */
  const text = [
    `${titleZh}`,
    "".padEnd(28, "="),
    "",
    `你的验证码是：  ${code}`,
    "",
    `有效期 ${minutes} 分钟，过期后需要重新获取。`,
    purpose === "reset"
      ? "把这个验证码填进页面即可设置新密码。"
      : purpose === "register"
        ? "把这个验证码填进页面即可完成注册。"
        : "把这个验证码填进页面即可完成邮箱换绑。",
    "",
    "请勿把验证码转发给任何人。",
    "",
    `请求时间：${timeLine}`,
    ...(ipLine ? [`请求 IP：${ipLine}`] : []),
    "",
    "如果不是你本人操作：忽略这封邮件即可，你的账号不会有任何变化。",
    "",
    "----------------------------------------",
    "",
    titleEn,
    "".padEnd(28, "="),
    "",
    `Your verification code is:  ${code}`,
    `It expires in ${minutes} minutes.`,
    "",
    "Never share this code with anyone.",
    "If you did not request this, you can safely ignore this email.",
    "",
    meta.siteUrl ? `${SITE_NAME} · ${meta.siteUrl}` : SITE_NAME,
  ].join("\n");

  /* ------------------------------------------------------------ HTML 版 */
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subjectZh)}</title>
<!--[if mso]>
<style>
  body,table,td,h1,p{font-family:'Segoe UI','Microsoft YaHei',Arial,sans-serif !important}
  .code-cell{font-family:'Courier New',monospace !important}
</style>
<![endif]-->
<style>
  /* 深色模式：所有覆盖都加 !important，否则压不过内联样式 */
  @media (prefers-color-scheme: dark) {
    .page-bg   { background:#101512 !important }
    .card      { background:#161C18 !important; border-color:#2A332D !important }
    .t-main    { color:#EDF1EE !important }
    .t-muted   { color:#93A39A !important }
    .t-faint   { color:#75857C !important }
    .divider   { border-color:#2A332D !important }
    .code-cell { background:#1E2721 !important; border-color:#33413A !important; color:#EDF1EE !important }
    .note-box  { background:#1A211C !important; border-color:#33413A !important }
    .amber-box { background:#251E12 !important; border-color:#4A3A1C !important }
    .t-amber   { color:#E0B166 !important }
    .brand-dot { background:#65BF8E !important; color:#101512 !important }
    .quote-bar { background:#33413A !important }
  }
  /* 移动端：缩小留白与数字方块 */
  @media only screen and (max-width:600px) {
    .wrap      { padding:16px 10px !important }
    .card-pad  { padding:24px 20px !important }
    .code-cell { width:38px !important; height:50px !important; font-size:22px !important; line-height:50px !important }
    .h1        { font-size:20px !important }
  }
</style>
</head>
<body class="page-bg" style="margin:0;padding:0;background:${C.pageBg};-webkit-text-size-adjust:100%">

  <!-- 收件箱列表里的摘要，正文里看不见 -->
  <div style="display:none;font-size:1px;color:${C.pageBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">
    你的验证码已就绪，${minutes} 分钟内有效 / Your code is ready and valid for ${minutes} minutes
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page-bg" style="background:${C.pageBg}">
    <tr>
      <td align="center" class="wrap" style="padding:32px 12px">

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="card" style="width:560px;max-width:560px;background:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden">

          <!-- 品牌条 -->
          <tr>
            <td class="card-pad" style="padding:22px 32px;border-bottom:1px solid ${C.border}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <span class="brand-dot" style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:7px;background:${C.primary};color:#FFFFFF;font-family:${FONT};font-size:14px;font-weight:700;vertical-align:middle">M</span>
                    <span class="t-main" style="display:inline-block;margin-left:9px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.text};vertical-align:middle">${esc(SITE_NAME)}</span>
                  </td>
                  <td align="right" valign="middle">
                    <span class="t-faint" style="font-family:${FONT};font-size:12px;color:${C.faint}">安全验证</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 正文 -->
          <tr>
            <td class="card-pad" style="padding:32px">

              <h1 class="h1 t-main" style="margin:0 0 6px;font-family:${FONT};font-size:23px;font-weight:700;line-height:1.35;color:${C.text}">${esc(titleZh)}</h1>
              <p class="t-muted" style="margin:0 0 26px;font-family:${FONT};font-size:13px;color:${C.muted}">${esc(titleEn)}</p>

              <!-- 验证码 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>${digitCells(code)}</tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 有效期 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">
                <tr>
                  <td align="center">
                    <span class="amber-box t-amber" style="display:inline-block;padding:5px 12px;background:${C.amberSoft};border:1px solid ${C.amberBorder};border-radius:999px;font-family:${FONT};font-size:12px;color:${C.amber}">
                      ${minutes} 分钟内有效 · expires in ${minutes} min
                    </span>
                  </td>
                </tr>
              </table>

              <!-- 分隔 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 24px">
                <tr><td class="divider" style="border-top:1px solid ${C.border};font-size:0;line-height:0">&nbsp;</td></tr>
              </table>

              <!-- 为什么收到 -->
              <p class="t-main" style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:600;color:${C.text}">为什么收到这封邮件？</p>
              <p class="t-muted" style="margin:0 0 18px;font-family:${FONT};font-size:13px;line-height:1.75;color:${C.muted}">${esc(whyZh)}</p>

              <!-- 安全提示 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="note-box" style="background:${C.primarySoft};border-radius:12px">
                <tr>
                  <td width="3" class="quote-bar" style="width:3px;background:${C.primary};border-radius:12px 0 0 12px">&nbsp;</td>
                  <td style="padding:14px 16px">
                    <p class="t-main" style="margin:0 0 4px;font-family:${FONT};font-size:13px;font-weight:600;color:${C.text}">请勿转发给任何人</p>
                    <p class="t-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted}">我们的工作人员永远不会向你索要这个验证码。如果不是你本人操作，忽略这封邮件即可 —— 你的账号不会有任何变化。</p>
                  </td>
                </tr>
              </table>

              <!-- 请求信息 -->
              <p class="t-faint" style="margin:18px 0 0;font-family:${FONT};font-size:11px;line-height:1.9;color:${C.faint}">
                请求时间：${esc(timeLine)}${ipLine ? `<br>请求 IP：${esc(ipLine)}` : ""}
              </p>

              <!-- 分隔 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 18px">
                <tr><td class="divider" style="border-top:1px solid ${C.border};font-size:0;line-height:0">&nbsp;</td></tr>
              </table>

              <!-- 英文区 -->
              <p class="t-muted" style="margin:0 0 6px;font-family:${FONT};font-size:12px;font-weight:600;color:${C.muted}">${esc(titleEn)}</p>
              <p class="t-faint" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.75;color:${C.faint}">
                Your verification code is <strong class="t-main" style="color:${C.text};font-family:${MONO}">${code}</strong>, valid for ${minutes} minutes.
                Never share this code with anyone. If you did not request it, you can safely ignore this email.
              </p>

            </td>
          </tr>

          <!-- 页脚 -->
          <tr>
            <td class="card-pad divider" style="padding:18px 32px;border-top:1px solid ${C.border}">
              <p class="t-faint" style="margin:0;font-family:${FONT};font-size:11px;line-height:1.7;color:${C.faint}">
                这是一封系统邮件，请勿直接回复。<br>
                ${esc(SITE_NAME)}${meta.siteUrl ? ` · <span style="color:${C.primary}">${esc(meta.siteUrl)}</span>` : ""}
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
