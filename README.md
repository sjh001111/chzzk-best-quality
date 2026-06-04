# CHZZK Best Quality

치지직을 볼 때 화질을 가능한 최고로 고정해주는 Tampermonkey 유저스크립트입니다.

1080p가 있으면 1080p로, 없으면 사용할 수 있는 최고 화질로 재생되도록 도와줍니다.

## 설치

1. [Tampermonkey](https://www.tampermonkey.net/)를 설치합니다.
2. [CHZZK Best Quality - GreasyFork](https://greasyfork.org/ko/scripts/580717-chzzk-best-quality)를 엽니다.
3. GreasyFork의 설치 버튼을 누릅니다.

직접 설치가 필요하면 [chzzk-best-quality.user.js](https://update.greasyfork.org/scripts/580717/CHZZK%20Best%20Quality.user.js)를 열면 됩니다.

개발 원본은 [GitHub](https://github.com/sjh001111/chzzk-best-quality)에 있습니다.

## 하는 일

- 1080p가 있으면 1080p를 우선 선택합니다.
- 1080p가 없으면 가능한 최고 화질을 선택합니다.
- 화질 메뉴 버튼을 직접 누르지 않고 재생 후보를 정리합니다.
- 광고 차단 경고가 뜨는 원인 플래그를 정리합니다.

## 동작 원리

치지직 VOD의 playback 응답에는 여러 화질 `Representation`이 들어 있습니다. 이 스크립트는 재생 정보 응답을 읽을 때 1080p가 있으면 1080p 후보만 남기고, 없으면 사용 가능한 최고 화질 후보만 남겨 플레이어에 전달합니다.

라이브나 일부 HLS 재생에서 쓰는 `.m3u8` master playlist도 같은 기준으로 정리합니다.

또한 재생 정보 응답에 광고 차단 감지 플래그가 들어오면 해당 값만 정리합니다. 경고 팝업을 DOM에서 강제로 지우거나 플레이어 단축키를 따로 가로채지 않습니다.

그래서 화질 메뉴를 자동으로 클릭하는 방식보다 UI 변경에 덜 민감합니다.

## 참고

- 치지직이 제공하지 않는 1080p를 새로 만들지는 않습니다.
- 치지직 재생 구조가 바뀌면 업데이트가 필요할 수 있습니다.
