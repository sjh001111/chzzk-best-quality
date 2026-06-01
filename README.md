# CHZZK Best Quality

[![설치](https://img.shields.io/badge/설치-userscript-00a67e?style=for-the-badge)](https://github.com/sjh001111/chzzk-best-quality/raw/main/chzzk-best-quality.user.js)

치지직에서 영상이 144p 같은 낮은 화질로 시작되는 문제를 줄이기 위한 유저스크립트입니다.

플레이어의 화질 설정 버튼을 찾아서 누르는 방식이 아닙니다. CHZZK의 HLS master playlist를 가로채서 1080p가 있으면 1080p 스트림만 남기고, 1080p가 없으면 사용 가능한 최고 화질 스트림만 플레이어에 넘깁니다.

## 주요 기능

- 치지직이 1080p HLS 스트림을 제공하면 1080p로 고정합니다.
- 1080p가 없으면 가능한 최고 해상도/FPS/bitrate 스트림으로 fallback합니다.
- 화질 메뉴 DOM이나 CHZZK 내부 CSS 클래스명에 의존하지 않습니다.
- 재생 중 뜨는 광고 차단 안내 팝업을 자동으로 닫습니다.
- 외부 의존성이 없습니다.

## 설치

1. Tampermonkey 또는 Violentmonkey 같은 유저스크립트 매니저를 설치합니다.
2. 위의 `설치` 버튼을 누릅니다.
3. 유저스크립트 매니저의 설치 화면이 뜨면 설치합니다.

직접 설치 링크:

```text
https://github.com/sjh001111/chzzk-best-quality/raw/main/chzzk-best-quality.user.js
```

## 동작 원리

CHZZK 영상 재생은 HLS playlist를 사용합니다. HLS master playlist에는 보통 `144p`, `720p`, `1080p` 같은 여러 화질 후보가 들어 있습니다.

이 스크립트는 `fetch`와 `XMLHttpRequest`로 요청되는 `.m3u8` playlist를 감지하고, `#EXT-X-STREAM-INF` 항목을 파싱한 뒤 선택한 화질 하나만 남긴 playlist를 플레이어에 돌려줍니다.

즉, 플레이어가 144p를 선택하지 못하게 억지로 UI를 누르는 게 아니라, 애초에 플레이어가 볼 수 있는 후보를 최고 화질 하나로 줄입니다.

## 화질 선택 기준

1. 세로 해상도 `1080`인 스트림을 우선 선택합니다.
2. 1080p 스트림이 여러 개면 FPS가 높은 것을 선택합니다.
3. FPS도 같으면 bandwidth가 높은 것을 선택합니다.
4. 1080p가 없으면 가능한 최고 해상도를 선택하고, 동률이면 FPS와 bandwidth 순서로 고릅니다.

## 제한사항

- CHZZK 서버가 1080p를 제공하지 않는 영상은 1080p로 만들 수 없습니다.
- CHZZK가 일반적인 HLS master playlist 방식이 아닌 다른 재생 구조로 바꾸면 업데이트가 필요할 수 있습니다.

## 개발

검사 명령:

```sh
npm test
npm run check
```

테스트는 Node.js 기본 모듈만 사용합니다. mocked `fetch`/`XMLHttpRequest` 기반 HLS 필터링, 720p fallback, 경고 팝업 자동 닫기, 디버그 전역 미노출을 확인합니다.

## 라이선스

MIT
