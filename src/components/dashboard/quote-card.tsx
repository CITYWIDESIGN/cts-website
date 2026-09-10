"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Quote, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { EASE_OUT } from "@/components/motion/transitions";

/**
 * 一言（Hitokoto）卡片。
 *
 * 数据源：https://v1.hitokoto.cn —— 公开、无需鉴权、支持 CORS。
 * `?c=` 可指定分类：k 哲学 / d 文学 / i 诗词 / a 动画 / c 游戏 / e 原创。
 *
 * 三个稳健性设计：
 * 1. **服务端不请求** —— 初值用本地句子，挂载后才去拉取；避免拖慢首屏，
 *    也避免构建/无外网环境下出错（本地句子本身就是合法兜底内容，
 *    所以首帧不会有空白或布局跳动）。
 * 2. 请求失败或超时（2.5s）时保留当前句子，不会变成空白卡片。
 * 3. 点击「换一句」重新拉取；句子切换带淡入位移。
 */

const HITOKOTO_URL = "https://v1.hitokoto.cn/?c=c&c=e&c=i&c=k";
const TIMEOUT_MS = 2500;

interface Quote {
  text: string;
  from: string | null;
  locale: "zh" | "en";
}

/** 本地兜底句子：首帧即显示，也用于接口不可用时 */
const LOCAL_QUOTES: Record<"zh" | "en", Quote[]> = {
  zh: [
    { text: "所有的相遇，都是久别重逢。", from: null, locale: "zh" },
    { text: "愿你走出半生，归来仍是少年。", from: null, locale: "zh" },
    { text: "把每一个方块放好，世界就会慢慢成形。", from: null, locale: "zh" },
    { text: "慢慢来，比较快。", from: null, locale: "zh" },
  ],
  en: [
    { text: "Every meeting is a reunion after a long parting.", from: null, locale: "en" },
    { text: "May you return still young at heart.", from: null, locale: "en" },
    { text: "Put each block down carefully and the world takes shape.", from: null, locale: "en" },
    { text: "Take it slow — slow is smooth, smooth is fast.", from: null, locale: "en" },
  ],
};

function pickLocal(locale: string, index?: number): Quote {
  const list = LOCAL_QUOTES[locale.startsWith("zh") ? "zh" : "en"];
  const i = index ?? Math.floor(Math.random() * list.length);
  return list[i % list.length];
}

export function QuoteCard() {
  const t = useTranslations("dashboard.quote");
  const reduce = useReducedMotion();

  /**
   * 初值固定取第一条：服务端与客户端首帧必须一致，否则会 hydration 不匹配。
   * 挂载后再随机换一条、并尝试拉取一言。
   */
  const [quote, setQuote] = React.useState<Quote>(() => pickLocal("zh", 0));
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    // 先随机换一条本地句子。放进 setTimeout 回调里，
    // 避免在 effect 体内同步 setState（避免级联渲染）。
    const randomize = window.setTimeout(() => {
      if (!cancelled) setQuote(pickLocal("zh"));
    }, 0);

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(HITOKOTO_URL, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          hitokoto?: string;
          from?: string;
          from_who?: string | null;
        };
        if (!data.hitokoto) throw new Error("empty");
        if (!cancelled) {
          window.clearTimeout(randomize);
          setQuote({
            text: data.hitokoto,
            from: data.from_who || data.from || null,
            locale: "zh",
          });
        }
      } catch {
        // 拉取失败：保留本地句子即可，不打断阅读
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      window.clearTimeout(randomize);
    };
  }, []);

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Quote className="size-4" />
        </span>
        <button
          type="button"
          onClick={() => setQuote((q) => pickLocal(q.locale))}
          disabled={loading}
          aria-label={t("refresh")}
          title={t("refresh")}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-4 flex-1">
        <motion.p
          key={quote.text}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="text-balance text-sm leading-relaxed"
        >
          {quote.text}
        </motion.p>

        <p className="mt-3 min-h-4 text-xs text-muted-foreground">
          {quote.from ? `— ${quote.from}` : ""}
        </p>
      </div>
    </div>
  );
}
