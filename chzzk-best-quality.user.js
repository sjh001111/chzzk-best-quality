// ==UserScript==
// @name         CHZZK Best Quality
// @namespace    sjh001111/chzzk-best-quality
// @version      2026.06.04.4
// @author       sjh001111
// @license      MIT
// @description  치지직 재생 화질을 1080p 또는 사용 가능한 최고 화질로 고정합니다.
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

  const toNumber = (...values) => {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) return number;
    }

    return 0;
  };

  const findLabelValue = (labels, kind) => {
    if (!Array.isArray(labels)) return "";

    const label = labels.find((item) => item && item["@kind"] === kind);
    return label ? label["#text"] || "" : "";
  };

  const parseQualityIdHeight = (qualityId) => {
    const match = String(qualityId || "").match(/(?:^|_)(\d{3,4})P(?:_|$)/i);
    return match ? match[1] : "";
  };

  const parseRepresentation = (item) => {
    const labels = item && item["nvod:Label"];
    const qualityId = findLabelValue(labels, "qualityId") || item["@id"];

    return {
      item,
      height: toNumber(
        item && item["@height"],
        item && item.height,
        findLabelValue(labels, "resolution"),
        parseQualityIdHeight(qualityId),
      ),
      width: toNumber(item && item["@width"], item && item.width),
      fps: toNumber(
        item && item["@frameRate"],
        item && item.frameRate,
        findLabelValue(labels, "fps"),
      ),
      bandwidth: toNumber(item && item["@bandwidth"], item && item.bandwidth),
    };
  };

  const parseVideoTrack = (item) => {
    const bitrate = item && item.bitrate;
    const bitrateValue =
      bitrate && typeof bitrate === "object"
        ? Number(bitrate.video || 0) + Number(bitrate.audio || 0)
        : bitrate;

    return {
      item,
      height: toNumber(item && item.height, item && item.videoHeight),
      width: toNumber(item && item.width, item && item.videoWidth),
      fps: toNumber(item && item.fps, item && item.videoFrameRate),
      bandwidth: toNumber(
        item && item.bandwidth,
        item && item.videoBitrate,
        bitrateValue,
        bitrate && bitrate.total,
      ),
    };
  };

  const isVideoTrack = (variant) => {
    const item = variant.item;
    return (
      variant.height > 0 &&
      variant.width > 0 &&
      !!item &&
      typeof item === "object" &&
      (!!item.encodingOption ||
        !!item.encodingOptionID ||
        !!item.videoQuality ||
        !!item.bitrate ||
        !!item.videoBitrate)
    );
  };

  const patchRepresentationGroup = (value) => {
    const representations = value && value.Representation;
    if (!Array.isArray(representations) || representations.length < 2) return false;

    const variants = representations.map(parseRepresentation).filter((item) => item.height > 0);
    if (variants.length < 2) return false;

    const chosen = chooseVariant(variants);
    value.Representation = [chosen.item];

    if (chosen.height) {
      if (Object.prototype.hasOwnProperty.call(value, "@maxHeight")) {
        value["@maxHeight"] = String(chosen.height);
      }
      if (Object.prototype.hasOwnProperty.call(value, "maxHeight")) {
        value.maxHeight = chosen.height;
      }
    }

    if (chosen.width) {
      if (Object.prototype.hasOwnProperty.call(value, "@maxWidth")) {
        value["@maxWidth"] = String(chosen.width);
      }
      if (Object.prototype.hasOwnProperty.call(value, "maxWidth")) {
        value.maxWidth = chosen.width;
      }
    }

    return true;
  };

  const patchVideoTrackList = (value) => {
    const list = value && value.list;
    if (!Array.isArray(list) || list.length < 2) return false;

    const variants = list.map(parseVideoTrack);
    if (!variants.every(isVideoTrack)) return false;

    const chosen = chooseVariant(variants);
    value.list = [chosen.item];

    if (Object.prototype.hasOwnProperty.call(chosen.item, "selected")) {
      chosen.item.selected = true;
    }
    if (Object.prototype.hasOwnProperty.call(chosen.item, "isDefault")) {
      chosen.item.isDefault = true;
    }

    return true;
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

  const patchPayload = (value, seen = new WeakSet()) => {
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

    if (patchRepresentationGroup(value)) changed = true;
    if (patchVideoTrackList(value)) changed = true;

    for (const child of Object.values(value)) {
      if (patchPayload(child, seen)) changed = true;
    }

    return changed;
  };

  const patchJsonText = (text) => {
    if (
      typeof text !== "string" ||
      (!text.includes(`"${DAB_FLAG}"`) &&
        !(text.includes('"MPD"') && text.includes('"Representation"')) &&
        !(text.includes('"videos"') && text.includes('"list"')))
    ) {
      return text;
    }

    try {
      const data = JSON.parse(text);
      return patchPayload(data) ? JSON.stringify(data) : text;
    } catch {
      return text;
    }
  };

  const transformTextResponse = (url, text) => {
    if (isPlaylistUrl(url)) return filterMasterPlaylist(text);
    return patchJsonText(text);
  };

  const patchJsonResponse = (response) => {
    const nativeJson =
      response && typeof response.json === "function" ? response.json.bind(response) : null;
    const nativeText =
      response && typeof response.text === "function" ? response.text.bind(response) : null;
    const nativeClone =
      response && typeof response.clone === "function" ? response.clone.bind(response) : null;

    const descriptors = {};
    if (nativeJson) {
      descriptors.json = {
        configurable: true,
        value: async () => {
          const data = await nativeJson();
          patchPayload(data);
          return data;
        },
      };
    }
    if (nativeText) {
      descriptors.text = {
        configurable: true,
        value: async () => patchJsonText(await nativeText()),
      };
    }
    if (nativeClone) {
      descriptors.clone = {
        configurable: true,
        value: () => patchJsonResponse(nativeClone()),
      };
    }

    try {
      Object.defineProperties(response, descriptors);
    } catch {
      return response;
    }

    return response;
  };

  const installFetchFilter = () => {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function") return;

    window.fetch = async (...args) => {
      const response = await nativeFetch.apply(window, args);
      const url = getRequestUrl(args[0]) || response.url;
      if (!isPlaylistUrl(url)) {
        return patchJsonResponse(response);
      }

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
      patchPayload(value);
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
