// ==UserScript==
// @name         CHZZK Best Quality
// @namespace    sjh001111/chzzk-best-quality
// @version      2026.06.03.4
// @author       sjh001111
// @license      MIT
// @description  치지직 HLS 재생을 1080p 또는 사용 가능한 최고 화질로 고정합니다.
// @match        https://chzzk.naver.com/*
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/sjh001111/chzzk-best-quality
// @supportURL   https://github.com/sjh001111/chzzk-best-quality/issues
// @downloadURL  https://raw.githubusercontent.com/sjh001111/chzzk-best-quality/main/chzzk-best-quality.user.js
// @updateURL    https://raw.githubusercontent.com/sjh001111/chzzk-best-quality/main/chzzk-best-quality.user.js
// ==/UserScript==

(() => {
  "use strict";

  const TARGET_HEIGHT = 1080;
  const PLAYLIST_URL_RE = /\.m3u8(?:[?#]|$)/i;
  const STREAM_INF = "#EXT-X-STREAM-INF";
  const DAB_FLAG = "dab";

  const getRequestUrl = (input) => {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  };

  const isPlaylistUrl = (url) => PLAYLIST_URL_RE.test(url || "");

  const parseAttributes = (line) => {
    const attrs = {};
    const body = line.slice(line.indexOf(":") + 1);
    const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
    let match;

    while ((match = re.exec(body))) {
      attrs[match[1]] = match[2].replace(/^"|"$/g, "");
    }

    return attrs;
  };

  const parseVariant = (block) => {
    const attrs = parseAttributes(block.lines[0]);
    const resolution = (attrs.RESOLUTION || "").match(/(\d+)x(\d+)/);
    const height = resolution ? Number(resolution[2]) : 0;

    return {
      ...block,
      height,
      fps: Number(attrs["FRAME-RATE"] || 0),
      bandwidth: Number(attrs["AVERAGE-BANDWIDTH"] || attrs.BANDWIDTH || 0),
    };
  };

  const compareQuality = (a, b) =>
    b.height - a.height || b.fps - a.fps || b.bandwidth - a.bandwidth;

  const chooseVariant = (variants) => {
    const target = variants
      .filter((variant) => variant.height === TARGET_HEIGHT)
      .sort(compareQuality);

    return target[0] || [...variants].sort(compareQuality)[0];
  };

  const filterMasterPlaylist = (text) => {
    if (
      typeof text !== "string" ||
      !text.includes("#EXTM3U") ||
      !text.includes(STREAM_INF)
    ) {
      return text;
    }

    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text.split(/\r?\n/);
    const blocks = [];

    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].startsWith(STREAM_INF)) continue;

      let end = i + 1;
      while (end < lines.length && lines[end].startsWith("#")) end += 1;

      if (end < lines.length && lines[end].trim()) {
        blocks.push({ start: i, end, lines: lines.slice(i, end + 1) });
        i = end;
      }
    }

    const variants = blocks.map(parseVariant).filter((variant) => variant.height > 0);
    if (variants.length < 2) return text;

    const chosen = chooseVariant(variants);
    const drop = new Set();

    for (const block of blocks) {
      if (block.start === chosen.start && block.end === chosen.end) continue;
      for (let line = block.start; line <= block.end; line += 1) drop.add(line);
    }

    return lines.filter((_, index) => !drop.has(index)).join(eol);
  };

  const patchDabFlags = (value, seen = new WeakSet()) => {
    const tag = Object.prototype.toString.call(value);
    if (
      !value ||
      typeof value !== "object" ||
      seen.has(value) ||
      (tag !== "[object Object]" && tag !== "[object Array]")
    ) {
      return false;
    }

    seen.add(value);

    let changed = false;
    if (
      Object.prototype.hasOwnProperty.call(value, DAB_FLAG) &&
      value[DAB_FLAG] !== false
    ) {
      value[DAB_FLAG] = false;
      changed = true;
    }

    for (const child of Object.values(value)) {
      if (patchDabFlags(child, seen)) changed = true;
    }

    return changed;
  };

  const patchJsonText = (text) => {
    if (typeof text !== "string" || !text.includes(`"${DAB_FLAG}"`)) return text;

    try {
      const data = JSON.parse(text);
      return patchDabFlags(data) ? JSON.stringify(data) : text;
    } catch {
      return text;
    }
  };

  const transformTextResponse = (url, text) => {
    if (isPlaylistUrl(url)) return filterMasterPlaylist(text);
    return patchJsonText(text);
  };

  const isJsonResponse = (response) => {
    const contentType =
      response && response.headers && typeof response.headers.get === "function"
        ? response.headers.get("content-type") || ""
        : "";

    return /\bjson\b/i.test(contentType);
  };

  const installFetchFilter = () => {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function") return;

    window.fetch = async (...args) => {
      const response = await nativeFetch.apply(window, args);
      const url = getRequestUrl(args[0]) || response.url;
      if (!isPlaylistUrl(url) && !isJsonResponse(response)) return response;

      let text;
      try {
        text = await response.clone().text();
      } catch {
        return response;
      }

      const filtered = transformTextResponse(url, text);
      if (filtered === text) return response;

      const headers = new window.Headers(response.headers);
      headers.delete("content-length");

      return new window.Response(filtered, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
  };

  const installXhrFilter = () => {
    const xhrProto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (!xhrProto) return;

    const urls = new WeakMap();
    const cache = new WeakMap();
    const nativeOpen = xhrProto.open;

    xhrProto.open = function open(method, url, ...rest) {
      urls.set(this, String(url || ""));
      return nativeOpen.call(this, method, url, ...rest);
    };

    const filterCached = (xhr, text) => {
      const url = urls.get(xhr) || xhr.responseURL || "";
      if (typeof text !== "string") return text;

      const cached = cache.get(xhr);
      if (cached && cached.source === text) return cached.filtered;

      const filtered = transformTextResponse(url, text);
      cache.set(xhr, { source: text, filtered });
      return filtered;
    };

    const filterObject = (xhr, value) => {
      if (isPlaylistUrl(urls.get(xhr) || xhr.responseURL || "")) return value;
      patchDabFlags(value);
      return value;
    };

    for (const prop of ["responseText", "response"]) {
      const descriptor = Object.getOwnPropertyDescriptor(xhrProto, prop);
      if (!descriptor || typeof descriptor.get !== "function" || !descriptor.configurable) {
        continue;
      }

      Object.defineProperty(xhrProto, prop, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          const value = descriptor.get.call(this);
          return typeof value === "string"
            ? filterCached(this, value)
            : filterObject(this, value);
        },
      });
    }
  };

  installFetchFilter();
  installXhrFilter();
})();
