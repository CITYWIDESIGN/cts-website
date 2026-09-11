/**
 * 客户端 IP 的**唯一**来源。
 *
 * 为什么要有这个文件：原来两处（`@/server/quota` 与
 * `lib/actions/auth/throttle`）各自取 `x-forwarded-for` 的**第一个**值。
 * 而代理链里第一个值是**客户端自己塞进去的** —— nginx / Caddy 只会把自己
 * 观测到的对端地址**追加到末尾**（`$proxy_add_x_forwarded_for`）。
 *
 * 后果是实打实的：每次请求换一个随机的 XFF，就能拿到一个全新的限流桶 ——
 * 登录爆破限流、上传/下载配额**全部形同虚设**。
 *
 * 所以这里统一成三条规则：
 *   1. 取**最右边**那个值（最近一层代理亲眼看到的对端地址）
 *   2. 必须能解析成合法 IP —— 否则攻击者还能用垃圾字符串当键，
 *      把 `TransferUsage` / `DailyAction` 的行数撑爆
 *   3. 完全不可信时返回 `"unknown"`，让所有人**共用**一个桶（宁可误伤，不可漏放）
 *
 * 部署在代理后面时无需配置；直连（没有代理）时 `x-forwarded-for` 全是伪造的，
 * 那种部署请设 `TRUST_PROXY=0`，此时一律返回 `"unknown"`。
 */

/** 由最近一层代理追加的地址：它亲眼看到的对端，改不了 */
const FORWARDED_FOR = "x-forwarded-for";
const REAL_IP = "x-real-ip";

const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** IPv6：只做结构校验（十六进制分组 + 最多一个 `::`），够挡住垃圾输入 */
const IPV6 = /^(?=.*:)[0-9a-f:]{2,45}$/;

/**
 * 规范化一个候选地址。
 *
 * 处理三件事，都是为了"同一个来源必须落成同一个键"：
 *   - `[::1]:443` → `::1`（带端口的 IPv6）
 *   - `1.2.3.4:5678` → `1.2.3.4`（带端口的 IPv4）
 *   - IPv6 统一小写、去掉末尾多余的 `:`
 *
 * 解析不出来返回 null，由调用方回退到 `"unknown"`。
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = raw.trim();
  // 有些代理会把 IPv4-mapped IPv6 写成 ::ffff:1.2.3.4，这里保留原样（仍是合法 IP）
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end > 0) value = value.slice(1, end);
  } else if (value.includes(":") && value.includes(".")) {
    // 1.2.3.4:5678 —— 只有一个冒号才是"IPv4:端口"
    const colon = value.indexOf(":");
    if (colon === value.lastIndexOf(":")) value = value.slice(0, colon);
  }

  value = value.trim().toLowerCase();
  if (!value || value.length > 45) return null;

  if (IPV4.test(value)) return value;
  if (IPV6.test(value)) {
    // 掐掉末尾的冒号（`2001:db8::` 是合法的，`2001:db8:::` 不是）
    while (value.endsWith(":::")) value = value.slice(0, -1);
    return value;
  }
  return null;
}

/**
 * 从请求头里取客户端 IP。
 *
 * 传入的是 `Headers`（`Request.headers` 或 `next/headers` 的 `headers()`），
 * 这样 Server Action 与 Route Handler 能共用同一份实现。
 */
export function clientIpFromHeaders(headers: Headers): string {
  if (process.env.TRUST_PROXY === "0") return "unknown";

  const forwarded = headers.get(FORWARDED_FOR);
  if (forwarded) {
    // 从右往左找第一个合法地址：右边是代理写的，左边是客户端伪造的
    const parts = forwarded.split(",");
    for (let i = parts.length - 1; i >= 0; i--) {
      const ip = normalizeIp(parts[i]);
      if (ip) return ip;
    }
  }

  return normalizeIp(headers.get(REAL_IP)) ?? "unknown";
}

/** Route Handler 用 */
export function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}
