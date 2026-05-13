# TravelFrame

TravelFrame은 여행 사진을 같은 구도로 촬영하고, 사진을 편집하고, 짧은 여행 클립 미리보기까지 만드는 Expo 앱입니다.

## 실행 방법

이 프로젝트는 Expo SDK 55 기준으로 준비되어 있습니다.

```bash
npm install
npm run start
```

Expo가 패키지 버전 정리를 요청하면 아래 명령을 실행합니다.

```bash
npx expo install --fix
```

카메라, 오디오, 영상 관련 패키지는 `package.json`에 정리되어 있습니다. 해당 패키지만 다시 설치하려면 아래 명령을 사용합니다.

```bash
npm run install:media
```

## 현재 범위

- 구도 가이드 카메라
- 이전 사진 반투명 오버레이
- 사진 편집과 비율 프리셋
- 전환 효과와 음악이 있는 여행 클립 미리보기
- FFmpeg 또는 서버 렌더링 기반 MP4 내보내기 검토
