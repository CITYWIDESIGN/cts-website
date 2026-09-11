"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Quote, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EASE_OUT } from "@/components/motion/transitions";

/**
 * 一言（Hitokoto）卡片。
 *
 * 数据源：https://v1.hitokoto.cn —— 公开、无需鉴权、支持 CORS。
 * `?c=` 可指定分类：k 哲学 / d 文学 / i 诗词 / a 动画 / c 游戏 / e 原创。
 *
 * 稳健性设计：
 * 1. **服务端不请求** —— 初值用本地句子，挂载后才去拉取；避免拖慢首屏，
 *    也避免构建/无外网环境下出错（本地句子本身就是合法兜底内容，
 *    所以首帧不会有空白或布局跳动）。
 * 2. 请求失败或超时（2.5s）时退回本地句子，不会变成空白卡片。
 * 3. **「换一句」是真的去拉新的一条**，不是从本地预设里轮换。
 *    拉不到才退回本地，并且保证换到的是**和当面这句不同**的，
 *    否则点了按钮看不出任何变化。
 * 4. 一言是中文接口，所以**只在中文界面出网**；英文界面直接用本地英文句子，
 *    不然英文用户会看到一段中文。
 */

const HITOKOTO_URL = "https://v1.hitokoto.cn/?c=c&c=e&c=i&c=k";
const TIMEOUT_MS = 2500;

interface Quote {
  text: string;
  from: string | null;
}

/** 本地兜底句子：首帧即显示，也用于接口不可用时 */
const LOCAL_QUOTES = {
  zh: [
    { text: "所有的相遇，都是久别重逢。", from: null },
    { text: "愿你走出半生，归来仍是少年。", from: null },
    { text: "把每一个方块放好，世界就会慢慢成形。", from: null },
    { text: "慢慢来，比较快。", from: null },
  ],
  en: [
    { text: "Every meeting is a reunion after a long parting.", from: null },
    { text: "May you return still young at heart.", from: null },
    { text: "Put each block down carefully and the world takes shape.", from: null },
    { text: "Take it slow — slow is smooth, smooth is fast.", from: null },
  ],
} as const;

/**
 * 取一条本地句子。
 *
 * `avoid` 传当前这句时，会尽量挑一条**不同的** —— 拉取失败退回本地时，
 * 至少让用户看到内容确实变了。只有一个候选（或全都一样）时才允许重复。
 */
function pickLocal(isZh: boolean, index?: number, avoid?: string): Quote {
  const list: readonly Quote[] = LOCAL_QUOTES[isZh ? "zh" : "en"];
  if (index !== undefined) return list[index % list.length];

  const pool = avoid ? list.filter((q) => q.text !== avoid) : list;
  const from = pool.length > 0 ? pool : list;
  return from[Math.floor(Math.random() * from.length)];
}

export function QuoteCard() {
  const t = useTranslations("dashboard.quote");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const isZh = locale.startsWith("zh");

  /**
   * 初值固定取第一条：服务端与客户端首帧必须一致，否则会 hydration 不匹配。
   * 挂载后再随机换一条、并尝试拉取一言。
   */
  const [quote, setQuote] = React.useState<Quote>(() => pickLocal(isZh, 0));
  const [loading, setLoading] = React.useState(false);

  /** 拉一条新的一言。失败就退回本地句子，「换一句」始终有反馈 */
  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      // 一言是中文接口，英文界面没有对应数据源，直接走本地
      if (!isZh) throw new Error("no-source");

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

      setQuote({ text: data.hitokoto, from: data.from_who || data.from || null });
    } catch {
      setQuote((q) => pickLocal(isZh, undefined, q.text));
    } finally {
      setLoading(false);
    }
  }, [isZh]);

  React.useEffect(() => {
    /*
      挂载后做两件事：先随机换一条本地句子（接口不通时首屏也不会一直是同一句），
      再去拉一条真实的一言。

      两件都放进 setTimeout 回调，而不是直接写在 effect 体内 —— 在 effect 体内
      同步 setState 会触发级联渲染，lint（react-hooks/set-state-in-effect）
      也会直接报错（它会顺着 refresh 追进去看到 setLoading）。
    */
    const id = window.setTimeout(() => {
      setQuote((q) => pickLocal(isZh, undefined, q.text));
      void refresh();
    }, 0);

    return () => window.clearTimeout(id);
  }, [isZh, refresh]);

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Quote className="size-4" />
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
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
