import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import { decodeString, decodeVarInt, encodeVarInt, encodeString } from "./mc-ping";

/**
 * 端到端跑一遍真实 socket 路径：起一个假服务端，说一遍协议，
 * 确认客户端真的能把 JSON 解出来。
 *
 * 单元测试只能证明编码函数自洽；这里证明的是**握手包发对了** ——
 * 真服务端对握手只回一次，发错就是静默超时，光看代码看不出来。
 */

function packet(packetId: number, payload: Buffer): Buffer {
  const body = Buffer.concat([encodeVarInt(packetId), payload]);
  return Buffer.concat([encodeVarInt(body.length), body]);
}

function statusResponse(json: unknown): Buffer {
  return packet(0x00, encodeString(JSON.stringify(json)));
}

/** 起一个假 MC 服务端；返回值里带关闭方法 */
async function fakeServer(
  onHandshake?: (info: { host: string; port: number; nextState: number }) => void
): Promise<{ port: number; close: () => Promise<void> }> {
  const server: Server = createServer((socket: Socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      // 依次解出两个包：handshake 和 status request
      let offset = 0;
      const packets: Buffer[] = [];
      for (let i = 0; i < 2; i++) {
        const len = decodeVarInt(buf, offset);
        if (!len) return;
        const end = offset + len.bytes + len.value;
        if (buf.length < end) return;
        packets.push(buf.subarray(offset + len.bytes, end));
        offset = end;
      }

      // 解析 handshake 内容（只有测试需要，正式代码不解析它）
      const handshakeBody = packets[0];
      const id = decodeVarInt(handshakeBody, 0);
      if (id) {
        const protocol = decodeVarInt(handshakeBody, id.bytes);
        if (protocol) {
          const host = decodeString(handshakeBody, id.bytes + protocol.bytes);
          if (host) {
            const portOffset = id.bytes + protocol.bytes + host.bytes;
            const port =
              (handshakeBody[portOffset] << 8) | handshakeBody[portOffset + 1];
            const state = decodeVarInt(handshakeBody, portOffset + 2);
            onHandshake?.({
              host: host.value,
              port,
              nextState: state?.value ?? -1,
            });
          }
        }
      }

      socket.write(
        statusResponse({
          version: { name: "1.21", protocol: 767 },
          players: { online: 7, max: 50 },
          description: { text: "CTS ", extra: [{ text: "服务器" }] },
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/** 每一轮都换一个端口，所以要清掉模块内的缓存（用 0 TTL 也行，这里更直接） */
async function withEnv<T>(
  env: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    previous[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("对真实 TCP 走一遍握手，能拿到在线人数 / 版本 / MOTD", async () => {
  const seen: Array<{ host: string; port: number; nextState: number }> = [];
  const server = await fakeServer((info) => seen.push(info));
  try {
    // 动态 import：环境变量要在模块读取前就位
    const { getServerStatus } = await import("./mc-ping");
    const status = await withEnv(
      {
        MC_PING: "1",
        MC_PING_HOST: "127.0.0.1",
        MC_PING_PORT: String(server.port),
        MC_PING_CACHE_MS: "0",
      },
      () => getServerStatus()
    );

    assert.equal(status?.online, true);
    assert.deepEqual(status?.players, { online: 7, max: 50 });
    assert.equal(status?.version, "1.21");
    assert.equal(status?.motd, "CTS 服务器");
    assert.ok((status?.latencyMs ?? -1) >= 0);

    // 握手包必须带对的目标和 nextState=1（status）
    assert.equal(seen.length, 1);
    assert.equal(seen[0].host, "127.0.0.1");
    assert.equal(seen[0].port, server.port);
    assert.equal(seen[0].nextState, 1);
  } finally {
    await server.close();
  }
});

test("服务器没开时返回 offline，而不是抛错", async () => {
  // 占一个端口再立刻释放，保证这个端口上是没人听的
  const probe = await fakeServer();
  const deadPort = probe.port;
  await probe.close();

  const { getServerStatus } = await import("./mc-ping");
  const status = await withEnv(
    {
      MC_PING: "1",
      MC_PING_HOST: "127.0.0.1",
      MC_PING_PORT: String(deadPort),
      MC_PING_CACHE_MS: "0",
      MC_PING_TIMEOUT_MS: "500",
    },
    () => getServerStatus()
  );

  assert.equal(status?.online, false);
  assert.equal(status?.players, null);
});

test("MC_PING=0 时返回 null，表示'没开启探测'（而不是'离线'）", async () => {
  const { getServerStatus } = await import("./mc-ping");
  const status = await withEnv({ MC_PING: "0" }, () => getServerStatus());
  assert.equal(status, null);
});

test("默认关闭：什么都没配时不探测（否则没本地 MC 服务的部署会白等超时）", async () => {
  const { getServerStatus } = await import("./mc-ping");
  const status = await withEnv(
    { MC_PING: "", MC_PING_HOST: "" },
    () => getServerStatus()
  );
  assert.equal(status, null);
});
