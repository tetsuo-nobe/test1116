// コメントボード画面（CommentWebUI）のロジック。
// ブラウザでもテスト（Vitest + jsdom）でも同じコードを使えるよう、DOM と fetch は引数で受け取る。

/** コメント本文の最大文字数（API 仕様と同じ）。 */
export const MAX_BODY_LENGTH = 500;

// ---------------------------------------------------------------------------
// 業務ロジック（フロント側）
// ---------------------------------------------------------------------------

/**
 * 送信前に本文を検証する（最終判定はバックエンド）。
 * @param {unknown} body 入力された本文
 * @returns {string | null} エラーメッセージ。問題なければ null
 */
export function validateBody(body) {
  if (typeof body !== "string" || body.trim() === "") {
    return "コメントを入力してください";
  }
  // 文字数は String#length（UTF-16 単位）で数える。textarea の maxlength と同じ数え方。
  if (body.length > MAX_BODY_LENGTH) {
    return `コメントは ${MAX_BODY_LENGTH} 文字以内で入力してください`;
  }
  return null;
}

/**
 * コメントを保存時刻（createdAt）の新しい順に並べた新しい配列を返す。元の配列は変更しない。
 * createdAt が解釈できないものは末尾に回す。
 * @param {Array<{id: string, body: string, createdAt: string}>} comments
 * @returns {Array<{id: string, body: string, createdAt: string}>}
 */
export function sortNewestFirst(comments) {
  const toTime = (comment) => {
    const time = Date.parse(comment?.createdAt);
    return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
  };
  return [...comments].sort((a, b) => {
    const diff = toTime(b) - toTime(a);
    // 両方とも解釈できない場合（-Infinity 同士）は NaN になるため同順位として扱う
    return Number.isNaN(diff) ? 0 : diff;
  });
}

// ---------------------------------------------------------------------------
// API 呼び出し層
// ---------------------------------------------------------------------------

/** API がエラー応答（非 2xx）を返したことを表すエラー。 */
export class ApiError extends Error {
  /**
   * @param {string} message 利用者に見せる理由（応答の message、なければ既定文言）
   * @param {number} status HTTP ステータスコード
   */
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * API のベース URL を検証し、末尾スラッシュを除いて返す。
 * @param {unknown} apiUrl
 * @returns {string}
 */
function normalizeApiUrl(apiUrl) {
  if (typeof apiUrl !== "string" || apiUrl.trim() === "") {
    throw new Error("API の URL が設定されていません（config.js の window.APP_CONFIG.apiUrl を確認してください）");
  }
  return apiUrl.trim().replace(/\/+$/, "");
}

/**
 * fetch 関数が渡されているか確認する。
 * @param {unknown} fetchFn
 */
function assertFetchFn(fetchFn) {
  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn には fetch 互換の関数を渡してください");
  }
}

/**
 * エラー応答から利用者向けの理由を取り出す。本文が JSON でない、または message がない場合は既定文言を使う。
 * @param {{status: number, json: () => Promise<unknown>}} response
 * @returns {Promise<string>}
 */
async function readErrorMessage(response) {
  const fallback = `サーバーでエラーが発生しました（HTTP ${response.status}）`;
  try {
    const data = await response.json();
    if (data && typeof data.message === "string" && data.message.trim() !== "") {
      return data.message;
    }
  } catch {
    // 本文が JSON でない場合は既定文言にする（エラー自体は呼び出し元へ ApiError として伝える）
  }
  return fallback;
}

/**
 * コメント一覧を取得する（GET /comments）。
 * 非 2xx は ApiError、通信失敗は fetch のエラーをそのまま呼び出し元へ投げる。
 * @param {string} apiUrl API のベース URL
 * @param {typeof fetch} fetchFn fetch 互換の関数
 * @returns {Promise<Array<{id: string, body: string, createdAt: string}>>}
 */
export async function fetchComments(apiUrl, fetchFn) {
  const baseUrl = normalizeApiUrl(apiUrl);
  assertFetchFn(fetchFn);

  const response = await fetchFn(`${baseUrl}/comments`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new ApiError("一覧の応答形式が正しくありません", response.status);
  }
  return data;
}

/**
 * コメントを保存する（POST /comments）。
 * 非 2xx は ApiError（400 なら応答の message が理由）、通信失敗は fetch のエラーをそのまま投げる。
 * @param {string} apiUrl API のベース URL
 * @param {string} body コメント本文
 * @param {typeof fetch} fetchFn fetch 互換の関数
 * @returns {Promise<{id: string, body: string, createdAt: string}>} 保存されたコメント
 */
export async function postComment(apiUrl, body, fetchFn) {
  const baseUrl = normalizeApiUrl(apiUrl);
  assertFetchFn(fetchFn);

  const response = await fetchFn(`${baseUrl}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// 画面の振る舞い
// ---------------------------------------------------------------------------

/** 一覧取得に失敗したときの表示文言（FR2.3）。 */
export const LOAD_ERROR_MESSAGE = "コメントを取得できませんでした";
/** 投稿に失敗したときの表示文言の接頭辞。後ろに理由を付ける。 */
export const POST_ERROR_PREFIX = "コメントを投稿できませんでした: ";

/**
 * ISO 8601 の保存時刻を画面表示用の文字列にする。解釈できなければ元の文字列を返す。
 * @param {string} createdAt
 * @returns {string}
 */
function formatCreatedAt(createdAt) {
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) {
    return String(createdAt ?? "");
  }
  return new Date(time).toLocaleString("ja-JP");
}

/**
 * コメント一覧を新しい順に描画する。本文・時刻は textContent で入れ、HTML として解釈させない（XSS 防止）。
 * @param {HTMLElement} listEl 一覧の要素（ul）
 * @param {Array<{id: string, body: string, createdAt: string}>} comments
 */
export function renderComments(listEl, comments) {
  const doc = listEl.ownerDocument;
  listEl.replaceChildren();

  if (comments.length === 0) {
    const emptyEl = doc.createElement("li");
    emptyEl.className = "comment-empty";
    emptyEl.dataset.testid = "comment-list-empty";
    emptyEl.textContent = "まだコメントはありません";
    listEl.append(emptyEl);
    return;
  }

  for (const comment of sortNewestFirst(comments)) {
    const itemEl = doc.createElement("li");
    itemEl.dataset.testid = "comment-list-item";

    const bodyEl = doc.createElement("p");
    bodyEl.className = "comment-body";
    bodyEl.dataset.testid = "comment-list-item-body";
    bodyEl.textContent = String(comment.body ?? "");

    const timeEl = doc.createElement("time");
    timeEl.dataset.testid = "comment-list-item-created-at";
    timeEl.setAttribute("datetime", String(comment.createdAt ?? ""));
    timeEl.textContent = formatCreatedAt(comment.createdAt);

    itemEl.append(bodyEl, timeEl);
    listEl.append(itemEl);
  }
}

/**
 * エラーメッセージを表示する（textContent で描画）。
 * @param {HTMLElement} el エラー表示領域
 * @param {string} message
 */
export function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

/**
 * エラーメッセージを消して表示領域を隠す。
 * @param {HTMLElement} el エラー表示領域
 */
export function clearError(el) {
  el.textContent = "";
  el.hidden = true;
}

/**
 * data-testid で必須の要素を探す。見つからなければ例外を投げる。
 * @param {Document} doc
 * @param {string} testId
 * @returns {HTMLElement}
 */
function requireElement(doc, testId) {
  const el = doc.querySelector(`[data-testid="${testId}"]`);
  if (!el) {
    throw new Error(`画面の要素が見つかりません: data-testid="${testId}"`);
  }
  return el;
}

/**
 * 画面を初期化する。表示時に一覧を取得し、投稿フォームの送信を処理する。
 * @param {{document: Document, apiUrl: string, fetchFn: typeof fetch}} options
 * @returns {{ready: Promise<void>, loadComments: () => Promise<void>, submitComment: () => Promise<void>}}
 *   ready は初回の一覧取得の完了。loadComments / submitComment は再取得・投稿処理（テストや再利用向け）。
 */
export function initApp({ document: doc, apiUrl, fetchFn }) {
  const formEl = requireElement(doc, "comment-form");
  const inputEl = requireElement(doc, "comment-form-body-input");
  const submitEl = requireElement(doc, "comment-form-submit-button");
  const errorEl = requireElement(doc, "comment-error-message");
  const listEl = requireElement(doc, "comment-list");

  if (typeof apiUrl !== "string" || apiUrl.trim() === "") {
    const message = "API の URL が設定されていません（config.js を確認してください）";
    showError(errorEl, message);
    throw new Error(message);
  }

  /** 一覧を取得して描画する。失敗はログに残し、画面に「コメントを取得できませんでした」を表示する。 */
  async function loadComments() {
    try {
      const comments = await fetchComments(apiUrl, fetchFn);
      renderComments(listEl, comments);
    } catch (error) {
      console.error("コメント一覧の取得に失敗しました", error);
      showError(errorEl, LOAD_ERROR_MESSAGE);
    }
  }

  /** 送信前チェック → POST → 入力欄を空に → 一覧再取得。失敗時は理由付きのエラーを表示し、入力欄は残す。 */
  async function submitComment() {
    const body = inputEl.value;
    const validationError = validateBody(body);
    if (validationError) {
      showError(errorEl, POST_ERROR_PREFIX + validationError);
      return;
    }

    submitEl.disabled = true;
    try {
      await postComment(apiUrl, body, fetchFn);
    } catch (error) {
      console.error("コメントの投稿に失敗しました", error);
      // 通信失敗（TypeError など）は理由が利用者向けでないため一般的な文言にする
      const reason = error instanceof ApiError ? error.message : "通信に失敗しました";
      showError(errorEl, POST_ERROR_PREFIX + reason);
      return;
    } finally {
      submitEl.disabled = false;
    }

    inputEl.value = "";
    clearError(errorEl);
    await loadComments();
  }

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    // submitComment 内で失敗は画面に表示済み。想定外の例外だけをここでログに残す
    submitComment().catch((error) => console.error("投稿処理で想定外のエラーが発生しました", error));
  });

  return { ready: loadComments(), loadComments, submitComment };
}
