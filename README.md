# CHZZK Force Best Quality

CHZZK에서 HLS 재생 품질이 144p 같은 낮은 화질로 시작되는 일을 막기 위한 userscript입니다.

이 스크립트는 플레이어 UI를 클릭하지 않습니다. 대신 HLS master playlist를 가로채서 1080p가 있으면 1080p variant만 남기고, 1080p가 없으면 사용 가능한 최고 해상도/FPS/bitrate variant만 남깁니다.

## Features

- Forces 1080p playback when CHZZK provides a 1080p HLS variant.
- Falls back to the best available variant when 1080p is unavailable.
- Works below the player UI layer, so it does not depend on CHZZK quality-menu class names.
- Dismisses CHZZK's playback warning dialog when it appears.
- Uses no external dependencies.

## Install

1. Install a userscript manager such as Tampermonkey or Violentmonkey.
2. Open `chzzk-force-best-quality.user.js` from this repository.
3. Use the raw file view and install it through the userscript manager.

## How It Works

CHZZK video playback uses HLS playlists. A master playlist usually contains multiple stream variants such as 144p, 720p, and 1080p.

The script intercepts playlist requests made through `fetch` and `XMLHttpRequest`, parses the `#EXT-X-STREAM-INF` entries, picks the preferred variant, and returns a filtered playlist to the player.

Selection priority:

1. Prefer variants with height `1080`.
2. If multiple 1080p variants exist, prefer higher FPS.
3. If FPS ties, prefer higher bandwidth.
4. If 1080p does not exist, use the highest available height, then FPS, then bandwidth.

## Limits

- This does not unlock or create 1080p if CHZZK does not provide it.
- If CHZZK changes playback away from ordinary HLS master playlists, the script may need an update.
- If audio is distorted with the script disabled too, the cause is outside this script.

## Development

Run the checks:

```sh
npm test
npm run check
```

The test suite uses Node's built-in modules only. It verifies playlist filtering through mocked `fetch` and `XMLHttpRequest`, the 720p fallback path, warning-dialog dismissal, and absence of debug globals.

## License

MIT
