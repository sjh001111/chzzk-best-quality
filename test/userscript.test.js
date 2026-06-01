const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.resolve(__dirname, "..", "chzzk-best-quality.user.js");
const code = fs.readFileSync(scriptPath, "utf8");

const playlist = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-STREAM-INF:BANDWIDTH=250000,RESOLUTION=256x144,FRAME-RATE=30",
  "144p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,FRAME-RATE=60",
  "720p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,FRAME-RATE=60",
  "1080p.m3u8",
  "",
].join("\n");

const fallbackPlaylist = [
  "#EXTM3U",
  "#EXT-X-STREAM-INF:BANDWIDTH=250000,RESOLUTION=256x144",
  "144p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720",
  "720p.m3u8",
  "",
].join("\n");

function makeDom() {
  const dialogs = [];
  const body = { style: { overflow: "hidden" } };
  const documentElement = { style: { overflow: "hidden" } };

  const document = {
    body,
    documentElement,
    querySelectorAll(selector) {
      if (selector === '[role="alertdialog"][aria-modal="true"]') return dialogs;
      return [];
    },
  };

  let observerCallback = null;
  class MutationObserver {
    constructor(callback) {
      observerCallback = callback;
    }

    observe() {}
  }

  return {
    document,
    MutationObserver,
    addWarningDialog() {
      let clicked = 0;
      let removed = 0;
      const root = {
        style: {},
        remove() {
          removed += 1;
        },
      };
      const button = {
        textContent: "확인",
        click() {
          clicked += 1;
        },
      };
      const dialog = {
        textContent:
          "광고 차단 프로그램을 사용 중이신가요? 재생 환경에 영향을 줄 수 있습니다. 확장 프로그램을 확인해 주세요. 확인",
        querySelectorAll(selector) {
          if (selector === "button") return [button];
          return [];
        },
        closest(selector) {
          if (selector === '[class*="popup_dimmed"]') return root;
          return null;
        },
        remove() {
          removed += 1;
        },
      };

      dialogs.push(dialog);
      observerCallback?.();

      return {
        get clicked() {
          return clicked;
        },
        get removed() {
          return removed;
        },
        get hidden() {
          return root.style.display === "none";
        },
      };
    },
  };
}

function makeWindow({ fetchText = playlist } = {}) {
  const dom = makeDom();
  const window = {
    document: dom.document,
    MutationObserver: dom.MutationObserver,
    Headers,
    Response,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    fetch: async () =>
      new Response(fetchText, {
        headers: { "content-type": "application/vnd.apple.mpegurl" },
        status: 200,
      }),
  };

  class MockXMLHttpRequest {
    open(method, url) {
      this.responseURL = url;
    }
  }

  Object.defineProperty(MockXMLHttpRequest.prototype, "responseText", {
    configurable: true,
    get() {
      return this._responseText;
    },
  });

  Object.defineProperty(MockXMLHttpRequest.prototype, "response", {
    configurable: true,
    get() {
      return this._responseText;
    },
  });

  window.XMLHttpRequest = MockXMLHttpRequest;
  return { window, dom };
}

async function loadScript(options) {
  const context = makeWindow(options);

  vm.runInNewContext(code, {
    window: context.window,
    document: context.window.document,
    MutationObserver: context.window.MutationObserver,
    Headers,
    Response,
    setTimeout,
    clearTimeout,
    console,
  });

  return context;
}

function assertOnlyQuality(text, expectedUri, forbiddenUris) {
  assert.match(text, new RegExp(`${expectedUri.replace(".", "\\.")}$`, "m"));
  for (const uri of forbiddenUris) assert.doesNotMatch(text, new RegExp(uri));
}

(async () => {
  {
    const { window } = await loadScript();
    const response = await window.fetch("https://example.test/master.m3u8");
    assertOnlyQuality(await response.text(), "1080p.m3u8", ["144p", "720p"]);
  }

  {
    const { window } = await loadScript({ fetchText: fallbackPlaylist });
    const response = await window.fetch("https://example.test/master.m3u8");
    assertOnlyQuality(await response.text(), "720p.m3u8", ["144p"]);
  }

  {
    const { window } = await loadScript();
    const xhr = new window.XMLHttpRequest();
    xhr._responseText = playlist;
    xhr.open("GET", "https://example.test/master.m3u8");
    assertOnlyQuality(xhr.responseText, "1080p.m3u8", ["144p", "720p"]);
  }

  {
    const { window, dom } = await loadScript();
    assert.equal(window.__CHZZK_FORCE_BEST_QUALITY__, undefined);

    const warning = dom.addWarningDialog();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(warning.hidden, true);
    assert.equal(warning.clicked, 1);
    assert.equal(warning.removed, 0);
    assert.equal(window.document.body.style.overflow, "");
    assert.equal(window.document.documentElement.style.overflow, "");
  }

  console.log("all checks passed");
})();
