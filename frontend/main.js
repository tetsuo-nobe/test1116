// 画面の起動処理。config.js が設定した API の URL とブラウザの fetch で initApp を呼ぶだけ。
import { initApp } from "./app.js";

initApp({
  document,
  apiUrl: window.APP_CONFIG?.apiUrl,
  // fetch は window に束縛して渡す（そのまま渡すと "Illegal invocation" になるブラウザがある）
  fetchFn: window.fetch.bind(window),
});
