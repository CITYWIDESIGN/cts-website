/**
 * 账号相关 Server Action 的返回类型。
 *
 * 独立成文件：它是**类型**不是 action。
 *
 * 这里**不能加 `"use server"`** —— 那个指令要求文件里所有导出都是
 * async 函数，而本文件只有类型（编译后没有任何运行时导出）。
 */

export type AuthState = {
  ok: boolean;
  /** 机器可读的错误码，前端映射成本地化文案 */
  error?: string;
  /** 成功时给前端做跳转用 */
  redirectTo?: string;
  /** 需要用户去填验证码（注册 / 换绑 / 重置的第一步） */
  needsCode?: boolean;
  /** 该邮箱是否已有待验证的码 */
  codeSent?: boolean;
  /** 未配置 SMTP 的开发环境下把验证码带回来，方便本地联调 */
  devCode?: string;
  /** 账号已建好但邮件没发出去，前端据此提示"重新发送" */
  mailFailed?: boolean;
  /** 频次限制类错误带回的额度（例如每天能改几次用户名） */
  limit?: number;
};
