import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateBody, fetchComments, postComment, ApiError, initApp } from "../app.js";

const API_URL = "https://api.example.test";

/** fetch の応答を表す最小オブジェクトを作る。 */
function jsonResponse(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

/** API 仕様（201 / 200 の要素）に沿ったコメントを作る。 */
function makeComment(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    body: "hello",
    createdAt: "2026-11-16T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 業務ロジック
// ---------------------------------------------------------------------------

describe("validateBody", () => {
  it("T1: 空・空白のみ・501 文字はエラー、1 文字と 500 文字は OK [FR1.3]", () => {
    expect(validateBody("")).toBe("コメントを入力してください");
    expect(validateBody("  \n\t ")).toBe("コメントを入力してください");
    expect(validateBody("a".repeat(501))).toBe("コメントは 500 文字以内で入力してください");

    expect(validateBody("a")).toBeNull();
    expect(validateBody("a".repeat(500))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// API 呼び出し層
// ---------------------------------------------------------------------------

describe("postComment", () => {
  it("T2: POST・JSON ボディで呼び、201 の JSON を返す [FR1.1]", async () => {
    const saved = makeComment({ body: "hello" });
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(201, saved));

    const result = await postComment(API_URL, "hello", fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API_URL}/comments`);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ body: "hello" });
    expect(result).toEqual(saved);
  });
});

describe("fetchComments", () => {
  it("T3: 500 応答で message 付きエラーを投げる [FR2.3]", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(500, { message: "DynamoDB に接続できません" }));

    const promise = fetchComments(API_URL, fetchFn);

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 500, message: "DynamoDB に接続できません" });
    expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/comments`, expect.objectContaining({ method: "GET" }));
  });
});

// ---------------------------------------------------------------------------
// 画面の振る舞い（jsdom + fetch モック）
// ---------------------------------------------------------------------------

/** index.html と同じ要素（data-testid 付き）を組み立てる。 */
function mountPage() {
  document.body.innerHTML = `
    <form data-testid="comment-form" novalidate>
      <textarea data-testid="comment-form-body-input"></textarea>
      <button type="submit" data-testid="comment-form-submit-button">投稿</button>
    </form>
    <p data-testid="comment-error-message" role="alert" hidden></p>
    <ul data-testid="comment-list"></ul>
  `;
}

const byTestId = (testId) => document.querySelector(`[data-testid="${testId}"]`);
const allByTestId = (testId) => [...document.querySelectorAll(`[data-testid="${testId}"]`)];
const postCalls = (fetchFn) => fetchFn.mock.calls.filter(([, options]) => options?.method === "POST");

/**
 * メソッドごとに応答を順に返す fetch モックを作る。値が Error なら reject する。
 * @param {{GET?: Array<object|Error>, POST?: Array<object|Error>}} queues
 */
function routedFetch(queues) {
  return vi.fn(async (_url, options) => {
    const next = queues[options.method]?.shift();
    if (next === undefined) {
      throw new Error(`想定外の呼び出し: ${options.method}`);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
}

describe("画面", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    mountPage();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("T4: 本文入力 → 投稿で POST が呼ばれ、入力欄が空になり、一覧が再取得され先頭に表示される [FR1.1, FR2.2]", async () => {
    const older = makeComment({ id: "c-old", body: "以前のコメント", createdAt: "2026-11-16T09:00:00.000Z" });
    const posted = makeComment({ id: "c-new", body: "新しいコメント", createdAt: "2026-11-16T10:00:00.000Z" });
    const fetchFn = routedFetch({
      GET: [jsonResponse(200, [older]), jsonResponse(200, [older, posted])], // 2 回目はあえて古い順で返す
      POST: [jsonResponse(201, posted)],
    });
    const app = initApp({ document, apiUrl: API_URL, fetchFn });
    await app.ready;

    byTestId("comment-form-body-input").value = "新しいコメント";
    byTestId("comment-form-submit-button").click();

    await vi.waitFor(() => expect(allByTestId("comment-list-item")).toHaveLength(2));
    expect(postCalls(fetchFn)).toHaveLength(1);
    expect(JSON.parse(postCalls(fetchFn)[0][1].body)).toEqual({ body: "新しいコメント" });
    expect(byTestId("comment-form-body-input").value).toBe("");
    const bodies = allByTestId("comment-list-item-body").map((el) => el.textContent);
    expect(bodies).toEqual(["新しいコメント", "以前のコメント"]);
    expect(byTestId("comment-list-item-created-at").getAttribute("datetime")).toBe(posted.createdAt);
    expect(byTestId("comment-error-message").hidden).toBe(true);
  });

  it("T5: 空白のみで投稿するとエラー表示され、fetch（POST）は呼ばれない [FR1.3]", async () => {
    const fetchFn = routedFetch({ GET: [jsonResponse(200, [])] });
    const app = initApp({ document, apiUrl: API_URL, fetchFn });
    await app.ready;

    byTestId("comment-form-body-input").value = "   ";
    byTestId("comment-form-submit-button").click();

    const errorEl = byTestId("comment-error-message");
    await vi.waitFor(() => expect(errorEl.hidden).toBe(false));
    expect(errorEl.textContent).toBe("コメントを投稿できませんでした: コメントを入力してください");
    expect(postCalls(fetchFn)).toHaveLength(0);
    expect(fetchFn).toHaveBeenCalledTimes(1); // 初回の一覧取得のみ
  });

  it("T6: API が 400 を返すとその message を含むエラーを表示し、入力欄は残る [FR1.3]", async () => {
    const fetchFn = routedFetch({
      GET: [jsonResponse(200, [])],
      POST: [jsonResponse(400, { message: "本文は 500 文字以内にしてください" })],
    });
    const app = initApp({ document, apiUrl: API_URL, fetchFn });
    await app.ready;

    byTestId("comment-form-body-input").value = "サーバーで拒否される本文";
    byTestId("comment-form-submit-button").click();

    const errorEl = byTestId("comment-error-message");
    await vi.waitFor(() => expect(errorEl.hidden).toBe(false));
    expect(errorEl.textContent).toBe("コメントを投稿できませんでした: 本文は 500 文字以内にしてください");
    expect(byTestId("comment-form-body-input").value).toBe("サーバーで拒否される本文");
    expect(byTestId("comment-form-submit-button").disabled).toBe(false);
    expect(fetchFn.mock.calls.filter(([, options]) => options.method === "GET")).toHaveLength(1); // 再取得しない
  });

  it("T7: 表示時の一覧取得が失敗（通信エラー）すると「コメントを取得できませんでした」を表示 [FR2.3]", async () => {
    const fetchFn = routedFetch({ GET: [new TypeError("Failed to fetch")] });

    const app = initApp({ document, apiUrl: API_URL, fetchFn });
    await app.ready;

    const errorEl = byTestId("comment-error-message");
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toBe("コメントを取得できませんでした");
    expect(allByTestId("comment-list-item")).toHaveLength(0);
    // 失敗は握りつぶさずログにも残す
    expect(consoleErrorSpy).toHaveBeenCalledWith("コメント一覧の取得に失敗しました", expect.any(TypeError));
  });

  it("T8: <script> を含む本文がテキストとして描画され、要素として挿入されない [NFR3]", async () => {
    const maliciousBody = '<script>window.__xss = true;</script><img src="x" onerror="window.__xss = true">';
    const fetchFn = routedFetch({ GET: [jsonResponse(200, [makeComment({ body: maliciousBody })])] });

    const app = initApp({ document, apiUrl: API_URL, fetchFn });
    await app.ready;

    const listEl = byTestId("comment-list");
    expect(byTestId("comment-list-item-body").textContent).toBe(maliciousBody);
    expect(listEl.querySelector("script")).toBeNull();
    expect(listEl.querySelector("img")).toBeNull();
    expect(window.__xss).toBeUndefined();
  });
});
