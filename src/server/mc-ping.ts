import "server-only";

import { createConnection, type Socket } from "node:net";

/**
 * Minecraft Server List Ping（1.7+ 的现代协议）。
 *
 * 为什么自己实现而不是调第三方 API：站点和服务器在同一台机器上，
 * 直接对 `127.0.0.1:25565` 说一次协议就够了 —— 不用把服务器地址交给外部服务，
 * 也不受对方限流影响。这个协议**不需要在服务端装任何插件**，
 * Fabric 原版就实现了。
 *
 * 协议流程（都是小端无关的 VarInt 前缀包）：
 *   1. Handshake：packetId 0x00 · protocolVersion · host · port · nextState(1=status)
 *   2. Status Request：packetId 0x00
 *   3. Status Response：packetId 0x00 · JSON 字符串
 *
 * 关键设计：
 *   - **超时很短**（默认 1500ms）并且**结果有缓存**（默认 30 秒）。
 *     首页每次渲染都去连一次的话，服务器没开的时候每个请求都要卡满超时。
 *   - **同时只允许一个探测在飞**（in-flight 复用），避免缓存过期瞬间
 *     并发请求一起打过去（stampede）。
 *   - 任何异常都翻译成 `{ online: false }`，**绝不抛给页面** ——
 *     探测失败只是"看起来离线"，不该让首页挂掉。
 */

/* ---------------------------------------------------------------- 配置 */

const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_CACHE_MS = 30_000;

/**
 * 读数字型环境变量。
 * 不能写成 `Number(x) || fallback` —— 那样 `MC_PING_CACHE_MS=0`
 * （测试里要靠它关掉缓存）会被当成 falsy 而回退成 30 秒。
 */
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * 是否启用探测。
 *
 * **默认关闭**，需要显式打开：
 *   - `MC_PING=0`     强制关闭
 *   - `MC_PING=1`     强制开启（地址用 MC_PING_HOST，默认 127.0.0.1）
 *   - 只设了 `MC_PING_HOST` 也算开启
 *
 * 为什么不做成默认开启：站点和 MC 服务器不在一台机器上的部署，
 * 每次缓存过期都要白等一个必然超时的探测，而且首页会错误地显示"离线"。
 * 这种事不该由默认值替用户决定。
 */
export function isPingEnabled(): boolean {
  if (process.env.MC_PING === "0") return false;
  if (process.env.MC_PING === "1") return true;
  return Boolean(process.env.MC_PING_HOST?.trim());
}

function target(): { host: string; port: number } {
  return {
    host: process.env.MC_PING_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.MC_PING_PORT) || 25565,
  };
}

/* ------------------------------------------------------ VarInt / 字符串 */

/**
 * VarInt 编码（协议规定：每字节低 7 位是数据，最高位表示"还有后续"）。
 * 负数按补码当作 32 位无符号处理 —— 协议版本传 -1 时就是这个情况。
 */
export function encodeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return Buffer.from(bytes);
}

/**
 * 从 `buf[offset]` 开始解一个 VarInt。
 * 字节不够或超过 5 字节（协议上限）返回 null。
 */
export function decodeVarInt(
  buf: Buffer,
  offset = 0
): { value: number; bytes: number } | null {
  let value = 0;
  let shift = 0;
  for (let i = 0; i < 5; i++) {
    const index = offset + i;
    if (index >= buf.length) return null;
    const b = buf[index];
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value: value >>> 0, bytes: i + 1 };
    shift += 7;
  }
  return null;
}

/** 带 VarInt 长度前缀的 UTF-8 字符串 */
export function encodeString(value: string): Buffer {
  const body = Buffer.from(value, "utf8");
  return Buffer.concat([encodeVarInt(body.length), body]);
}

/**
 * 从 `buf[offset]` 开始解一个带长度前缀的字符串。
 * 返回 null 表示"字节还不够"；抛错表示数据不合法（由调用方统一兜住）。
 */
export function decodeString(
  buf: Buffer,
  offset = 0
): { value: string; bytes: number } | null {
  const len = decodeVarInt(buf, offset);
  if (!len) return null;
  const start = offset + len.bytes;
  const end = start + len.value;
  if (end > buf.length) return null;
  return {
    value: buf.subarray(start, end).toString("utf8"),
    bytes: len.bytes + len.value,
  };
}

/** 包 = VarInt(长度) + VarInt(packetId) + 载荷 */
function encodePacket(packetId: number, payload: Buffer): Buffer {
  const body = Buffer.concat([encodeVarInt(packetId), payload]);
  return Buffer.concat([encodeVarInt(body.length), body]);
}

/* ------------------------------------------------------------ 协议实现 */

export interface McStatus {
  online: boolean;
  /** 在线 / 上限。拿不到时是 null */
  players: { online: number; max: number } | null;
  /** 服务端版本名（如 "1.21"） */
  version: string | null;
  motd: string | null;
  /** 从发出握手到收到响应的毫秒数 */
  latencyMs: number | null;
  /** 失败原因，仅用于日志 */
  error?: string;
}

const OFFLINE = (error?: string): McStatus => ({
  online: false,
  players: null,
  version: null,
  motd: null,
  latencyMs: null,
  error,
});

/** MOTD 可能是字符串，也可能是 `{ text, extra: [...] }` 的结构，拍平成纯文本 */
function flattenMotd(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") return null;

  const node = raw as { text?: unknown; extra?: unknown };
  const head = typeof node.text === "string" ? node.text : "";
  const extra = Array.isArray(node.extra)
    ? node.extra.map(flattenMotd).filter((s): s is string => Boolean(s)).join("")
    : "";
  const text = head + extra;
  return text || null;
}

/** 真正的一次探测（不带缓存） */
function probe(timeoutMs: number): Promise<McStatus> {
  const { host, port } = target();

  return new Promise<McStatus>((resolve) => {
    const started = Date.now();
    let settled = false;
    let socket: Socket | null = null;
    let received = Buffer.alloc(0);

    const finish = (status: McStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve(status);
    };

    const timer = setTimeout(
      () => finish(OFFLINE(`timeout after ${timeoutMs}ms`)),
      timeoutMs
    );

    const onReady = () => {
      // 1. Handshake：protocolVersion 用 -1（"我只想查状态"），nextState = 1
      const handshake = Buffer.concat([
        encodeVarInt(-1),
        encodeString(host),
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        encodeVarInt(1),
      ]);
      // 2. Status Request：空载荷
      socket?.write(
        Buffer.concat([encodePacket(0x00, handshake), encodePacket(0x00, Buffer.alloc(0))])
      );
    };

    try {
      socket = createConnection({ host, port });
    } catch (err) {
      finish(OFFLINE(err instanceof Error ? err.message : String(err)));
      return;
    }

    socket.setNoDelay(true);
    socket.on("connect", onReady);
    socket.on("error", (err) => finish(OFFLINE(err.message)));

    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);

      const len = decodeVarInt(received, 0);
      if (!len) return; // 长度前缀还没收全
      const total = len.bytes + len.value;
      if (received.length < total) return; // 正文还没收全

      const body = received.subarray(len.bytes, total);
      const id = decodeVarInt(body, 0);
      if (!id || id.value !== 0x00) {
        finish(OFFLINE("unexpected packet id"));
        return;
      }
      const json = decodeString(body, id.bytes);
      if (!json) {
        finish(OFFLINE("malformed status payload"));
        return;
      }

      try {
        const parsed = JSON.parse(json.value) as {
          players?: { online?: unknown; max?: unknown };
          version?: { name?: unknown };
          description?: unknown;
        };
        const online = Number(parsed.players?.online);
        const max = Number(parsed.players?.max);

        finish({
          online: true,
          players:
            Number.isFinite(online) && Number.isFinite(max)
              ? { online, max }
              : null,
          version:
            typeof parsed.version?.name === "string" ? parsed.version.name : null,
          motd: flattenMotd(parsed.description),
          latencyMs: Date.now() - started,
        });
      } catch {
        finish(OFFLINE("invalid JSON in status response"));
      }
    });
  });
}

/* -------------------------------------------------------------- 缓存层 */

let cache: { at: number; value: McStatus } | null = null;
let inFlight: Promise<McStatus> | null = null;

/**
 * 读取服务器状态。
 *
 * `MC_PING=0` 时返回 null —— 表示"没有开启探测"，调用方应该回退到静态配置。
 * 这一点和"探测了但服务器离线"（`online: false`）是**两回事**，
 * 所以用 null 区分，而不是笼统地报离线。
 */
export async function getServerStatus(): Promise<McStatus | null> {
  if (!isPingEnabled()) return null;

  const ttl = envNumber("MC_PING_CACHE_MS", DEFAULT_CACHE_MS);
  const now = Date.now();
  if (cache && now - cache.at < ttl) return cache.value;

  // 缓存过期瞬间可能有一堆请求同时进来，只让第一个真的去探测
  if (!inFlight) {
    const timeoutMs = envNumber("MC_PING_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
    inFlight = probe(timeoutMs)
      .then((value) => {
        cache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}
