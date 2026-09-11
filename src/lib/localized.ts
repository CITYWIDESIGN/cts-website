/**
 * 双语内容。
 *
 * 站点文案走 next-intl（`messages/*.json`），但**管理员在后台填的内容**
 * 不能放在消息文件里 —— 那是构建产物的一部分。这里给的是那类内容的结构：
 * 中文必填，英文可选。
 *
 * 英文留空时**回退到中文**。与其在英文界面显示空白，不如显示原文；
 * 这样管理员可以先用中文把内容写起来，之后再补英文。
 */
export interface Localized {
  zh: string;
  en?: string | null;
}

/** 按当前语言取值，英文缺失时回退中文 */
export function pickLocalized(locale: string, value: Localized): string {
  if (locale.startsWith("en")) {
    const en = value.en?.trim();
    if (en) return en;
  }
  return value.zh;
}

/** 内容列表里每一项都需要稳定的 key，但内容本身可能没有 id */
export function localizedKey(value: Localized, index: number): string {
  return `${index}-${value.zh.slice(0, 24)}`;
}
