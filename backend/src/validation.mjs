// 入力検証: POST /comments のリクエスト本文（解析済みの JSON）を検証する。

export const MAX_BODY_LENGTH = 500;

/**
 * リクエスト本文を検証する。
 * @param {unknown} body 解析済みの JSON
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
export function validateBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'リクエスト本文は JSON オブジェクトにしてください。' };
  }
  const text = body.body;
  if (typeof text !== 'string') {
    return { ok: false, message: 'body は文字列で指定してください。' };
  }
  if (text.trim() === '') {
    return { ok: false, message: 'コメントを入力してください。' };
  }
  // 文字数はコードポイント単位で数える（絵文字などのサロゲートペアを 1 文字とする）
  if ([...text].length > MAX_BODY_LENGTH) {
    return { ok: false, message: `コメントは ${MAX_BODY_LENGTH} 文字以内で入力してください。` };
  }
  return { ok: true, value: text };
}
