// Comment エンティティの生成と並べ替え。
import { randomUUID } from 'node:crypto';

/**
 * 検証済みの本文から Comment を作る（ID と UTC ISO 8601 の保存時刻を付与）。
 * @param {string} body
 * @param {Date} [now]
 * @returns {{ id: string, body: string, createdAt: string }}
 */
export function createComment(body, now = new Date()) {
  return { id: randomUUID(), body, createdAt: now.toISOString() };
}

/**
 * createdAt の新しい順に並べた新しい配列を返す（元の配列は変更しない）。
 * createdAt は同じ形式の ISO 8601 UTC 文字列なので文字列比較で正しく並ぶ。
 * @param {Array<{ createdAt: string }>} list
 */
export function sortNewestFirst(list) {
  return [...list].sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
