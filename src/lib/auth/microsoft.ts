import "server-only";

import {
  randomBytes,
  createHash,
  createHmac,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import { createAuthLogger, type AuthLogger } from "./logger";
import { sessionSecret } from "@/lib/session-secret";

/**
 * Microsoft / Xbox / Minecraft OAuth 认证链路。
 *
 * 阶段拆分（每阶段独立日志、独立错误分类）：
 *   Microsoft OAuth → Xbox Live (XBL) → XSTS → Minecraft login → Minecraft Profile
 *
 * 参考官方文档：
 *   https://learn.microsoft.com/en-us/minecraft/creator/documents/authentication
 *   https://wiki.vg/Microsoft_Authentication_Scheme
 */

const MICROSOFT_AUTHORIZE_URL =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_AUTHENTICATE_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XBL_DEVICE_AUTH_URL = "https://device.auth.xboxlive.com/device/authenticate";
const XSTS_AUTHORIZE_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_WITH_XBOX =
  "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";

const REQUEST_TIMEOUT_MS = 10_000;

export interface MinecraftProfile {
  uuid: string;
  username: string;
  microsoftAccountId: string;
}

export class AuthError extends Error {
  code: string;
  httpStatus?: number;
  detail?: string;

  constructor(
    code: string,
    message: string,
    opts?: { httpStatus?: number; detail?: string }
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.detail = opts?.detail;
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AuthError(
      "MISSING_ENV",
      `Missing environment variable ${name}. Please configure Microsoft OAuth.`
    );
  }
  return value;
}

export function isMicrosoftConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );
}

// ---------------------------------------------------------------------------
// state（CSRF 防护，无状态签名）
// ---------------------------------------------------------------------------

/**
 * state 的签名密钥。
 * 与 session cookie 用同一个密钥（见 @/lib/session-secret）：
 * 生产环境缺失会在这里抛错，而不是悄悄用一个公开的默认值。
 */
function stateSecret(): string {
  return sessionSecret();
}

function signState(raw: string): string {
  return createHmac("sha256", stateSecret()).update(raw).digest("hex");
}

export function generateOAuthState(): string {
  const raw = randomBytes(32).toString("hex");
  return `${raw}.${signState(raw)}`;
}

export function verifyOAuthState(state: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 2) return false;
  const [raw, sig] = parts;
  const expected = signState(raw);
  if (sig.length !== expected.length) return false;
  return createHash("sha256")
    .update(sig)
    .digest()
    .equals(createHash("sha256").update(expected).digest());
}

/** 生成 Microsoft OAuth 授权 URL（redirect_uri 动态匹配请求地址） */
export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = env("MICROSOFT_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "XboxLive.signin offline_access openid",
    response_mode: "query",
    state,
    prompt: "select_account",
  });
  return `${MICROSOFT_AUTHORIZE_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Proof of Possession (PoP)：Minecraft Services 要求 XSTS 请求带证明密钥
// ---------------------------------------------------------------------------

interface ProofKey {
  jwk: Record<string, unknown>;
  privateKey: KeyObject;
}

function generateProofKey(): ProofKey {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" });
  return {
    jwk: { ...jwk, alg: "ES256", use: "sig" },
    privateKey,
  };
}

/** Windows FILETIME（自 1601-01-01 起，100 纳秒间隔） */
function windowsFileTime(): bigint {
  const unixToFiletime = BigInt(11644473600);
  const ticksPerSecond = BigInt(10000000);
  return (
    (BigInt(Math.floor(Date.now() / 1000)) + unixToFiletime) * ticksPerSecond
  );
}

/** 生成设备认证用的 UUID（Xbox 使用带花括号的 UUID 字符串） */
function generateXboxUuid(): string {
  return `{${randomBytes(16).toString("hex").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5")}}`;
}

/**
 * 对 Xbox 请求做 PoP 签名，生成 `Signature` header（用于 user/device/title/XSTS）。
 * 签名数据：version(4) + 0x00 + timestamp(8) + 0x00 + "POST\0" + path\0 + authToken\0 + body\0
 */
function signRequest(url: string, body: string, privateKey: KeyObject): string {
  const pathAndQuery = new URL(url).pathname;
  const ts = windowsFileTime();

  const version = Buffer.alloc(4);
  version.writeInt32BE(1, 0);
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64BE(ts, 0);

  const data = Buffer.concat([
    version,
    Buffer.from([0]),
    tsBuf,
    Buffer.from([0]),
    Buffer.from("POST\0", "utf8"),
    Buffer.from(`${pathAndQuery}\0`, "utf8"),
    Buffer.from("\0", "utf8"), // 空 authorization token
    Buffer.from(`${body}\0`, "utf8"),
  ]);

  const signature = sign("sha256", data, {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  const header = Buffer.alloc(12 + signature.length);
  header.writeInt32BE(1, 0);
  header.writeBigUInt64BE(ts, 4);
  signature.copy(header, 12);

  return header.toString("base64");
}

// ---------------------------------------------------------------------------
// 工具：超时 fetch + 非敏感错误信息提取
// ---------------------------------------------------------------------------

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: {
        // Minecraft / Xbox 服务对 User-Agent 敏感，需模拟官方 Launcher
        "User-Agent": "MinecraftLauncher/2.2.10675",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AuthError(
        "TIMEOUT",
        `Request timed out after ${timeoutMs}ms.`,
        { detail: url }
      );
    }
    throw err;
  }
}

/**
 * 从错误响应体中提取「非敏感」字段用于日志：
 * 只取 error / errorMessage / errorType / developerMessage / XErr / Message，
 * 绝不输出 token、Authorization、OAuth code 等。
 */
function extractErrorInfo(text: string): string {
  const trimmed = text.slice(0, 4000);
  try {
    const json = JSON.parse(trimmed);
    const parts: string[] = [];
    if (typeof json.error === "string") parts.push(`error=${json.error}`);
    if (typeof json.errorMessage === "string")
      parts.push(`errorMessage=${json.errorMessage}`);
    if (typeof json.errorType === "string") parts.push(`errorType=${json.errorType}`);
    if (typeof json.developerMessage === "string")
      parts.push(`developerMessage=${json.developerMessage}`);
    if (typeof json.XErr === "number") parts.push(`XErr=${json.XErr}`);
    if (typeof json.Message === "string") parts.push(`Message=${json.Message}`);
    if (parts.length) return parts.join(" | ");
    return "(JSON, no known error fields)";
  } catch {
    return trimmed.slice(0, 300);
  }
}

function describe(err: unknown): string {
  if (err instanceof AuthError) {
    return [err.code, err.httpStatus ? `status=${err.httpStatus}` : null, err.detail]
      .filter(Boolean)
      .join(" — ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

// ---------------------------------------------------------------------------
// 阶段 1：Microsoft OAuth（授权码 → token）
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}

async function microsoftOAuth(
  code: string,
  redirectUri: string,
  log: AuthLogger
): Promise<TokenResponse> {
  log.stage("Microsoft OAuth", "START");

  const clientId = env("MICROSOFT_CLIENT_ID");
  const clientSecret = env("MICROSOFT_CLIENT_SECRET");

  const res = await fetchJson(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "XboxLive.signin offline_access openid",
    }).toString(),
  });

  if (!res.ok) {
    const raw = await res.text();
    const detail = extractErrorInfo(raw);
    log.stage("Microsoft OAuth", "FAILED", `status=${res.status} ${detail}`);
    throw new AuthError(
      "MICROSOFT_OAUTH_FAILED",
      `Microsoft OAuth token exchange failed (${res.status}).`,
      { httpStatus: res.status, detail }
    );
  }

  const token = (await res.json()) as TokenResponse;
  if (!token.id_token) {
    log.stage("Microsoft OAuth", "FAILED", "no id_token");
    throw new AuthError("NO_ID_TOKEN", "Microsoft did not return an id_token.");
  }

  log.stage("Microsoft OAuth", "OK");
  return token;
}

// ---------------------------------------------------------------------------
// 阶段 2：Xbox Live 认证（XBL）
// ---------------------------------------------------------------------------

async function xboxLiveAuth(
  accessToken: string,
  proofKey: ProofKey,
  log: AuthLogger
): Promise<string> {
  log.stage("Xbox Live", "START");

  const body = JSON.stringify({
    Properties: {
      AuthMethod: "RPS",
      SiteName: "user.auth.xboxlive.com",
      RpsTicket: `d=${accessToken}`,
    },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  });
  const signature = signRequest(XBL_AUTHENTICATE_URL, body, proofKey.privateKey);

  const res = await fetchJson(XBL_AUTHENTICATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-xbl-contract-version": "2",
      Signature: signature,
    },
    body,
  });

  if (!res.ok) {
    const raw = await res.text();
    const detail = extractErrorInfo(raw);
    log.stage("Xbox Live", "FAILED", `status=${res.status} ${detail}`);
    throw new AuthError(
      "XBL_AUTH_FAILED",
      `Xbox Live authentication failed (${res.status}).`,
      { httpStatus: res.status, detail }
    );
  }

  const data = (await res.json()) as { Token?: string };
  if (!data.Token) {
    log.stage("Xbox Live", "FAILED", "no token in response");
    throw new AuthError("XBL_AUTH_FAILED", "Xbox Live returned no token.");
  }

  log.stage("Xbox Live", "OK");
  return data.Token;
}

/** 设备认证（Proof of Possession），返回 device token */
async function deviceAuth(proofKey: ProofKey, log: AuthLogger): Promise<string> {
  log.stage("Xbox Device", "START");

  const body = JSON.stringify({
    Properties: {
      AuthMethod: "ProofOfPossession",
      Id: generateXboxUuid(),
      DeviceType: "Nintendo",
      SerialNumber: generateXboxUuid(),
      Version: "0.0.0",
      ProofKey: proofKey.jwk,
    },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  });
  const signature = signRequest(XBL_DEVICE_AUTH_URL, body, proofKey.privateKey);

  const res = await fetchJson(XBL_DEVICE_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-xbl-contract-version": "1",
      Signature: signature,
    },
    body,
  });

  if (!res.ok) {
    const raw = await res.text();
    const detail = extractErrorInfo(raw);
    log.stage("Xbox Device", "FAILED", `status=${res.status} ${detail}`);
    throw new AuthError(
      "XBL_AUTH_FAILED",
      `Xbox device authentication failed (${res.status}).`,
      { httpStatus: res.status, detail }
    );
  }

  const data = (await res.json()) as { Token?: string };
  if (!data.Token) {
    log.stage("Xbox Device", "FAILED", "no token in response");
    throw new AuthError("XBL_AUTH_FAILED", "Xbox device authentication returned no token.");
  }

  log.stage("Xbox Device", "OK");
  return data.Token;
}

// ---------------------------------------------------------------------------
// 阶段 3：XSTS 授权
// ---------------------------------------------------------------------------

async function xstsAuth(
  userToken: string,
  deviceToken: string,
  proofKey: ProofKey,
  log: AuthLogger
): Promise<{ token: string; uhs: string }> {
  log.stage("XSTS", "START");

  const body = JSON.stringify({
    Properties: {
      SandboxId: "RETAIL",
      UserTokens: [userToken],
      DeviceToken: deviceToken,
      ProofKey: proofKey.jwk,
    },
    RelyingParty: "rp://api.minecraftservices.com/",
    TokenType: "JWT",
  });
  const signature = signRequest(XSTS_AUTHORIZE_URL, body, proofKey.privateKey);

  const res = await fetchJson(XSTS_AUTHORIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-xbl-contract-version": "1",
      Signature: signature,
    },
    body,
  });

  const data = (await res.json()) as {
    Token?: string;
    XErr?: number;
    Message?: string;
    DisplayClaims?: { xui?: Array<{ uhs?: string }> };
  };

  if (!res.ok || !data.Token) {
    // XErr 细分，便于判断账号问题
    // 2148916233 - 账号没有 Xbox 档案
    // 2148916235 - 账号地区不支持 Xbox Live
    const code =
      data.XErr === 2148916233
        ? "NO_XBOX_ACCOUNT"
        : data.XErr === 2148916235
          ? "REGION_NOT_SUPPORTED"
          : "XSTS_AUTH_FAILED";
    const detail = `status=${res.status} XErr=${data.XErr ?? "none"} Message=${data.Message ?? "none"}`;
    log.stage("XSTS", "FAILED", detail);
    throw new AuthError(
      code,
      `XSTS authorization failed: ${data.Message ?? data.XErr ?? res.status}`,
      { httpStatus: res.status, detail }
    );
  }

  // 关键：Minecraft 登录必须使用 XSTS 响应中的 uhs（而非 XBL 的 uhs）
  const uhs = data.DisplayClaims?.xui?.[0]?.uhs;
  if (!uhs) {
    log.stage("XSTS", "FAILED", "no uhs in response");
    throw new AuthError("XSTS_AUTH_FAILED", "XSTS returned no user hash.");
  }

  // 诊断：尝试解码 XSTS token（JWE 第一段是未加密的 protected header）
  let aud = "unavailable";
  try {
    const claims = decodeJwtPayload(data.Token);
    aud = String(claims.aud ?? "missing");
  } catch {
    const t = String(data.Token ?? "");
    const parts = t.split(".");
    let jweHeader = "";
    try {
      if (parts.length >= 2) {
        const header = JSON.parse(
          Buffer.from(parts[0], "base64url").toString("utf8")
        );
        jweHeader = JSON.stringify(header);
      }
    } catch {
      jweHeader = "header-undecodable";
    }
    aud = `jwe(parts=${parts.length}, header=${jweHeader})`;
  }

  log.stage(
    "XSTS",
    "OK",
    `uhs=${uhs.slice(0, 6)}...(len=${uhs.length}) ${aud}`
  );
  return { token: data.Token, uhs };
}

// ---------------------------------------------------------------------------
// 阶段 4：Minecraft login_with_xbox（XSTS → Minecraft access token）
// ---------------------------------------------------------------------------

async function minecraftLoginWithXbox(
  uhs: string,
  xstsToken: string,
  log: AuthLogger
): Promise<string> {
  // 脱敏记录请求结构：只输出 token 长度/前缀，绝不输出完整 token
  log.stage(
    "Minecraft Services",
    "START",
    `identityToken=XBL3.0 x=${uhs.slice(0, 6)}...(len=${uhs.length});${xstsToken.slice(0, 6)}...(len=${xstsToken.length})`
  );

  const res = await fetchJson(MC_LOGIN_WITH_XBOX, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    const requestId =
      res.headers.get("x-request-id") ??
      res.headers.get("x-minecraft-request-id") ??
      res.headers.get("request-id") ??
      "none";
    log.stage(
      "Minecraft Services",
      "FAILED",
      `status=${res.status} requestId=${requestId} body=${raw.slice(0, 500)}`
    );

    // 403 "Invalid app registration"：本应用的 client id 尚未被 Mojang 的 API allow list
    // 收录。这是部署侧的准入问题（而非用户账号问题），必须单独分类，才能给出「等审批」
    // 而不是「你账号有问题」的提示。详见 README「Minecraft API Allow List 审批」。
    const code =
      res.status === 403 && raw.includes("Invalid app registration")
        ? "MC_APP_NOT_APPROVED"
        : "MC_LOGIN_FAILED";

    throw new AuthError(code, `Minecraft login failed (${res.status}).`, {
      httpStatus: res.status,
      detail: raw.slice(0, 500),
    });
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    log.stage("Minecraft Services", "FAILED", "no access_token in response");
    throw new AuthError("MC_LOGIN_FAILED", "Minecraft login returned no token.");
  }

  log.stage("Minecraft Services", "OK");
  return data.access_token;
}

// ---------------------------------------------------------------------------
// 阶段 5：Minecraft Profile（UUID + 玩家名）
// ---------------------------------------------------------------------------

async function getMinecraftProfile(
  mcToken: string,
  log: AuthLogger
): Promise<{ id: string; name: string }> {
  log.stage("Minecraft Profile", "START");

  const res = await fetchJson(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcToken}` },
  });

  if (res.status === 404) {
    log.stage("Minecraft Profile", "FAILED", "status=404 (no Minecraft ownership)");
    throw new AuthError(
      "NO_MINECRAFT_PROFILE",
      "This Microsoft account does not own Minecraft."
    );
  }

  if (!res.ok) {
    const raw = await res.text();
    const detail = extractErrorInfo(raw);
    log.stage("Minecraft Profile", "FAILED", `status=${res.status} ${detail}`);
    throw new AuthError(
      "MC_PROFILE_FAILED",
      `Failed to fetch Minecraft profile (${res.status}).`,
      { httpStatus: res.status, detail }
    );
  }

  log.stage("Minecraft Profile", "OK");
  return (await res.json()) as { id: string; name: string };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthError("INVALID_JWT", "Invalid JWT structure.");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(payload);
}

/**
 * 完整认证链路：code → Minecraft Profile。
 * 每阶段独立日志（带 attemptId），任何失败都抛出分类明确的 AuthError。
 */
export async function authenticateWithMicrosoft(
  code: string,
  redirectUri: string,
  attemptId?: string
): Promise<MinecraftProfile> {
  const log = createAuthLogger(attemptId);

  // 1. Microsoft OAuth
  const token = await microsoftOAuth(code, redirectUri, log);

  const claims = decodeJwtPayload(token.id_token!);
  const microsoftAccountId = (claims.oid as string) ?? (claims.sub as string);
  if (!microsoftAccountId) {
    log.stage("Microsoft OAuth", "FAILED", "no account id in id_token");
    throw new AuthError("NO_ACCOUNT_ID", "Unable to determine Microsoft account id.");
  }

  // 生成 PoP 密钥对（user / device / XSTS 三个步骤共享）
  const proofKey = generateProofKey();

  // 2. Xbox Live user auth
  const userToken = await xboxLiveAuth(token.access_token, proofKey, log);

  // 3. Device auth
  const deviceToken = await deviceAuth(proofKey, log);

  // 4. XSTS（msal flow 不需要 title token）
  const xsts = await xstsAuth(userToken, deviceToken, proofKey, log);

  // 5. Minecraft login_with_xbox
  const mcToken = await minecraftLoginWithXbox(xsts.uhs, xsts.token, log);

  // 6. Minecraft Profile
  const profile = await getMinecraftProfile(mcToken, log);

  return {
    uuid: profile.id,
    username: profile.name,
    microsoftAccountId,
  };
}

export { describe };
