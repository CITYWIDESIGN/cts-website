import { test } from "node:test";
import assert from "node:assert/strict";
import { absoluteUrl, oauthRedirectUri, publicOrigin } from "./public-origin";

/**
 * 这个文件盯的是一个**只在容器/反代后面才暴露**的坑：
 * Dockerfile 设了 HOSTNAME=0.0.0.0、PORT=3000，于是
 * `new URL(request.url).origin` 在容器里是 `https://0.0.0.0:3000` ——
 * OAuth 的 redirect_uri 变成这个值，微软直接拒（invalid_request），
 * 登出和错误跳转也会把人送到死地址。
 */

/** 模拟容器里的请求：url 是内部的，真实地址只在转发头里 */
function containerRequest(headers: Record<string, string> = {}) {
  return new Request("https://0.0.0.0:3000/api/auth/login", { headers });
}

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("容器里不再返回 0.0.0.0:3000", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://web.ctserver.top" }, () => {
    assert.equal(publicOrigin(containerRequest()), "https://web.ctserver.top");
  });
});

test("NEXT_PUBLIC_SITE_URL 结尾的斜杠会被去掉", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://web.ctserver.top/" }, () => {
    assert.equal(publicOrigin(containerRequest()), "https://web.ctserver.top");
    assert.equal(absoluteUrl(containerRequest(), "/login").toString(), "https://web.ctserver.top/login");
  });
});

test("没配 NEXT_PUBLIC_SITE_URL 时用 x-forwarded-* 头", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: undefined }, () => {
    const req = containerRequest({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "web.ctserver.top",
    });
    assert.equal(publicOrigin(req), "https://web.ctserver.top");
  });
});

test("代理链拼了多跳时取第一个", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: undefined }, () => {
    const req = containerRequest({
      "x-forwarded-proto": "https, http",
      "x-forwarded-host": "web.ctserver.top, app:3000",
    });
    assert.equal(publicOrigin(req), "https://web.ctserver.top");
  });
});

test("什么都没有时才回退到 request.url（裸跑场景）", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: undefined }, () => {
    assert.equal(
      publicOrigin(new Request("http://localhost:3000/api/auth/login")),
      "http://localhost:3000"
    );
  });
});

test("redirect_uri：MICROSOFT_REDIRECT_URI 优先", () => {
  withEnv(
    {
      NEXT_PUBLIC_SITE_URL: "https://web.ctserver.top",
      MICROSOFT_REDIRECT_URI: "https://web.ctserver.top/api/auth/callback",
    },
    () => {
      assert.equal(
        oauthRedirectUri(containerRequest()),
        "https://web.ctserver.top/api/auth/callback"
      );
    }
  );
});

test("redirect_uri：没显式配置时按公开 origin 拼，且永远不是 0.0.0.0", () => {
  withEnv(
    {
      NEXT_PUBLIC_SITE_URL: "https://web.ctserver.top",
      MICROSOFT_REDIRECT_URI: undefined,
    },
    () => {
      const uri = oauthRedirectUri(containerRequest());
      assert.equal(uri, "https://web.ctserver.top/api/auth/callback");
      assert.ok(!uri.includes("0.0.0.0"), "redirect_uri 里不能出现 0.0.0.0");
    }
  );
});

test("授权与换 token 两处会算出一致的 redirect_uri", () => {
  withEnv(
    { NEXT_PUBLIC_SITE_URL: "https://web.ctserver.top", MICROSOFT_REDIRECT_URI: undefined },
    () => {
      // 两个 route 拿到的请求 url 内部形态不同，但对外必须一致
      const a = oauthRedirectUri(new Request("https://0.0.0.0:3000/api/auth/login"));
      const b = oauthRedirectUri(new Request("https://0.0.0.0:3000/api/auth/callback?code=x"));
      assert.equal(a, b);
    }
  );
});

test("absoluteUrl 拼出来的是对外地址", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://web.ctserver.top" }, () => {
    assert.equal(absoluteUrl(containerRequest(), "/").toString(), "https://web.ctserver.top/");
    const err = absoluteUrl(containerRequest(), "/login");
    err.searchParams.set("error", "invalid_state");
    assert.equal(err.toString(), "https://web.ctserver.top/login?error=invalid_state");
  });
});
